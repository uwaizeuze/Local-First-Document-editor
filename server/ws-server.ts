/**
 * Minimal Yjs WebSocket server compatible with y-websocket clients.
 * Deploy separately from Vercel (Railway, Fly.io, Render, etc.)
 */
import { config } from "dotenv";
import { WebSocketServer, WebSocket } from "ws";
import * as http from "http";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import postgres from "postgres";

// Load environment variables from .env.local
config({ path: ".env.local", override: true });

const PORT = Number(process.env.WS_PORT ?? 1234);
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL not set in environment");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { prepare: false });

const docs = new Map<string, WSSharedDoc>();

class WSSharedDoc extends Y.Doc {
  name: string;
  awareness: awarenessProtocol.Awareness;
  conns: Map<WebSocket, Set<number>>;

  constructor(name: string) {
    super({ gc: true });
    this.name = name;
    this.awareness = new awarenessProtocol.Awareness(this);
    this.conns = new Map();
  }
}

const messageSync = 0;
const messageAwareness = 1;

async function loadDocumentState(docName: string): Promise<Uint8Array | null> {
  try {
    // Load latest snapshot
    const snapshotRow = await sql`
      select snapshot, created_at
      from document_snapshots
      where document_id = ${docName}
      order by created_at desc
      limit 1
    `;

    if (!snapshotRow.length || !snapshotRow[0].snapshot) {
      // No snapshot exists - load all updates from beginning
      const updates = await sql`
        select update
        from document_updates
        where document_id = ${docName}
        order by clock asc
      `;

      if (!updates.length) return null;

      // Merge all updates into a single state
      const doc = new Y.Doc();
      for (const row of updates) {
        Y.applyUpdate(doc, new Uint8Array(row.update), "remote");
      }
      return Y.encodeStateAsUpdate(doc);
    }

    // Load snapshot and apply any updates after it
    const snapshot = snapshotRow[0].snapshot;
    const snapshotCreatedAt = snapshotRow[0].created_at;

    const updates = await sql`
      select update
      from document_updates
      where document_id = ${docName} and created_at > ${snapshotCreatedAt}
      order by clock asc
    `;

    if (!updates.length) {
      return snapshot;
    }

    // Apply snapshot then all subsequent updates
    const doc = new Y.Doc();
    Y.applyUpdate(doc, new Uint8Array(snapshot), "remote");
    for (const row of updates) {
      Y.applyUpdate(doc, new Uint8Array(row.update), "remote");
    }
    return Y.encodeStateAsUpdate(doc);
  } catch (err) {
    console.error("Failed to load document state:", err);
    return null;
  }
}

async function getYDoc(docName: string): Promise<WSSharedDoc> {
  let doc = docs.get(docName);
  if (!doc) {
    doc = new WSSharedDoc(docName);
    const state = await loadDocumentState(docName);
    if (state) {
      Y.applyUpdate(doc, new Uint8Array(state), "remote");
    }
    docs.set(docName, doc);
  }
  return doc;
}

function updateHandler(update: Uint8Array, _origin: unknown, doc: WSSharedDoc) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeUpdate(encoder, update);
  const message = encoding.toUint8Array(encoder);

  doc.conns.forEach((_, conn) => {
    if (conn.readyState === WebSocket.OPEN) {
      conn.send(message);
    }
  });
}

async function setupConnection(conn: WebSocket, docName: string) {
  const doc = await getYDoc(docName);
  doc.conns.set(conn, new Set());

  doc.on("update", (update: Uint8Array, origin: unknown) => {
    if (origin !== conn) {
      updateHandler(update, origin, doc);
    }
  });

  conn.on("message", (message: Buffer) => {
    try {
      const decoder = decoding.createDecoder(new Uint8Array(message));
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case messageSync: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageSync);
          syncProtocol.readSyncMessage(decoder, encoder, doc, conn);
          if (encoding.length(encoder) > 1) {
            conn.send(encoding.toUint8Array(encoder));
          }
          break;
        }
        case messageAwareness: {
          awarenessProtocol.applyAwarenessUpdate(
            doc.awareness,
            decoding.readVarUint8Array(decoder),
            conn,
          );
          break;
        }
      }
    } catch (err) {
      console.error("[ws] Message error:", err);
    }
  });

  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, doc);
    conn.send(encoding.toUint8Array(encoder));

    const awarenessStates = doc.awareness.getStates();
    if (awarenessStates.size > 0) {
      const aEncoder = encoding.createEncoder();
      encoding.writeVarUint(aEncoder, messageAwareness);
      encoding.writeVarUint8Array(
        aEncoder,
        awarenessProtocol.encodeAwarenessUpdate(
          doc.awareness,
          Array.from(awarenessStates.keys()),
        ),
      );
      conn.send(encoding.toUint8Array(aEncoder));
    }
  }

  const awarenessChangeHandler = (
    {
      added,
      updated,
      removed,
    }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    const changedClients = added.concat(updated, removed);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(doc.awareness, changedClients),
    );
    const msg = encoding.toUint8Array(encoder);
    doc.conns.forEach((_, c) => {
      if (c !== origin && c.readyState === WebSocket.OPEN) {
        c.send(msg);
      }
    });
  };

  doc.awareness.on("update", awarenessChangeHandler);

  conn.on("close", () => {
    doc.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(doc.awareness, [doc.clientID], conn);
    doc.awareness.off("update", awarenessChangeHandler);
    if (doc.conns.size === 0) {
      doc.destroy();
      docs.delete(docName);
    }
  });
}

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Yjs WebSocket Server\n");
});

const wss = new WebSocketServer({ server });

wss.on("connection", async (conn, req) => {
  const docName = (req.url ?? "/").slice(1).split("?")[0] || "default";
  await setupConnection(conn, docName);
});

server.listen(PORT, () => {
  console.log(`[y-websocket] Server running on ws://localhost:${PORT}`);
});

process.on("SIGINT", () => {
  wss.close();
  server.close();
  process.exit(0);
});
