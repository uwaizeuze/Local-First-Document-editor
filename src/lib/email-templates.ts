/**
 * Email HTML templates for document collaboration events.
 * Written as pure HTML strings so they work with any email provider
 * and render consistently across all email clients.
 */

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

const ROLE_COLORS: Record<string, string> = {
  owner: "#7c3aed",
  editor: "#2563eb",
  viewer: "#64748b",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: "Full control — you can edit, invite members, and delete the document.",
  editor: "You can read and edit the document content.",
  viewer: "You have read-only access to the document.",
};

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>DocEditor</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="display:inline-table;">
                <tr>
                  <td style="background:linear-gradient(135deg,#7c3aed,#2563eb);border-radius:12px;padding:10px 14px;vertical-align:middle;">
                    <span style="color:#fff;font-size:20px;">&#128196;</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="color:#f8fafc;font-size:22px;font-weight:700;letter-spacing:-0.5px;">DocEditor</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#13131a;border:1px solid #1e1e2e;border-radius:20px;padding:40px 36px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">
                You received this email because you're a member of a DocEditor document.<br/>
                <a href="${BASE_URL}" style="color:#7c3aed;text-decoration:none;">Visit DocEditor</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sent when a user is invited to a document for the first time.
 */
export function inviteEmailHtml(options: {
  recipientName: string;
  inviterName: string;
  documentTitle: string;
  documentId: string;
  role: string;
}): string {
  const { recipientName, inviterName, documentTitle, documentId, role } = options;
  const roleColor = ROLE_COLORS[role] ?? "#7c3aed";
  const roleLabel = ROLE_LABELS[role] ?? role;
  const roleDesc = ROLE_DESCRIPTIONS[role] ?? "";
  const docUrl = `${BASE_URL}/editor/${documentId}`;
  const firstName = recipientName.split(" ")[0];

  const content = `
    <h1 style="margin:0 0 8px;color:#f8fafc;font-size:26px;font-weight:700;line-height:1.2;">
      You've been invited! &#127881;
    </h1>
    <p style="margin:0 0 28px;color:#94a3b8;font-size:15px;line-height:1.6;">
      Hey ${firstName}, <strong style="color:#e2e8f0;">${inviterName}</strong> has invited you to collaborate on a document.
    </p>

    <!-- Document card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d14;border:1px solid #1e1e2e;border-radius:12px;margin-bottom:28px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 6px;color:#64748b;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Document</p>
          <p style="margin:0 0 12px;color:#f1f5f9;font-size:18px;font-weight:600;">${documentTitle}</p>
          <span style="display:inline-block;background:${roleColor}22;color:${roleColor};border:1px solid ${roleColor}44;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:600;">
            ${roleLabel}
          </span>
        </td>
      </tr>
    </table>

    <!-- Role description -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1e1b2e;border-left:3px solid ${roleColor};border-radius:0 8px 8px 0;margin-bottom:32px;">
      <tr>
        <td style="padding:14px 18px;">
          <p style="margin:0;color:#cbd5e1;font-size:14px;line-height:1.5;">
            <strong style="color:#e2e8f0;">As ${roleLabel}:</strong> ${roleDesc}
          </p>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
      <tr>
        <td align="center">
          <a href="${docUrl}"
             style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:12px;letter-spacing:0.2px;">
            Open Document &rarr;
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0;color:#475569;font-size:13px;text-align:center;">
      Or copy this link: <a href="${docUrl}" style="color:#7c3aed;">${docUrl}</a>
    </p>
  `;

  return baseLayout(content);
}

export function inviteEmailText(options: {
  recipientName: string;
  inviterName: string;
  documentTitle: string;
  documentId: string;
  role: string;
}): string {
  const { recipientName, inviterName, documentTitle, documentId, role } = options;
  const docUrl = `${BASE_URL}/editor/${documentId}`;
  return [
    `Hi ${recipientName},`,
    ``,
    `${inviterName} has invited you to collaborate on "${documentTitle}" as ${ROLE_LABELS[role] ?? role}.`,
    ``,
    `Open the document: ${docUrl}`,
    ``,
    `— DocEditor`,
  ].join("\n");
}

/**
 * Sent when an existing member's role is changed.
 */
export function roleChangedEmailHtml(options: {
  recipientName: string;
  changedByName: string;
  documentTitle: string;
  documentId: string;
  oldRole: string;
  newRole: string;
}): string {
  const { recipientName, changedByName, documentTitle, documentId, oldRole, newRole } =
    options;
  const oldColor = ROLE_COLORS[oldRole] ?? "#64748b";
  const newColor = ROLE_COLORS[newRole] ?? "#7c3aed";
  const newLabel = ROLE_LABELS[newRole] ?? newRole;
  const oldLabel = ROLE_LABELS[oldRole] ?? oldRole;
  const roleDesc = ROLE_DESCRIPTIONS[newRole] ?? "";
  const docUrl = `${BASE_URL}/editor/${documentId}`;
  const firstName = recipientName.split(" ")[0];

  const content = `
    <h1 style="margin:0 0 8px;color:#f8fafc;font-size:26px;font-weight:700;line-height:1.2;">
      Your role has changed &#128260;
    </h1>
    <p style="margin:0 0 28px;color:#94a3b8;font-size:15px;line-height:1.6;">
      Hey ${firstName}, <strong style="color:#e2e8f0;">${changedByName}</strong> has updated your access to <strong style="color:#e2e8f0;">${documentTitle}</strong>.
    </p>

    <!-- Role change visual -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d14;border:1px solid #1e1e2e;border-radius:12px;margin-bottom:28px;">
      <tr>
        <td style="padding:20px 24px;text-align:center;">
          <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>
              <td style="vertical-align:middle;">
                <span style="display:inline-block;background:${oldColor}22;color:${oldColor};border:1px solid ${oldColor}44;border-radius:999px;padding:6px 16px;font-size:13px;font-weight:600;text-decoration:line-through;opacity:0.7;">
                  ${oldLabel}
                </span>
              </td>
              <td style="vertical-align:middle;padding:0 16px;color:#475569;font-size:20px;">&rarr;</td>
              <td style="vertical-align:middle;">
                <span style="display:inline-block;background:${newColor}22;color:${newColor};border:1px solid ${newColor}44;border-radius:999px;padding:6px 16px;font-size:13px;font-weight:700;">
                  ${newLabel}
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- New permissions -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1e1b2e;border-left:3px solid ${newColor};border-radius:0 8px 8px 0;margin-bottom:32px;">
      <tr>
        <td style="padding:14px 18px;">
          <p style="margin:0;color:#cbd5e1;font-size:14px;line-height:1.5;">
            <strong style="color:#e2e8f0;">Your new access as ${newLabel}:</strong> ${roleDesc}
          </p>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
      <tr>
        <td align="center">
          <a href="${docUrl}"
             style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:12px;">
            Open Document &rarr;
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0;color:#475569;font-size:13px;text-align:center;">
      Or copy this link: <a href="${docUrl}" style="color:#7c3aed;">${docUrl}</a>
    </p>
  `;

  return baseLayout(content);
}

export function roleChangedEmailText(options: {
  recipientName: string;
  changedByName: string;
  documentTitle: string;
  documentId: string;
  oldRole: string;
  newRole: string;
}): string {
  const { recipientName, changedByName, documentTitle, documentId, oldRole, newRole } =
    options;
  const docUrl = `${BASE_URL}/editor/${documentId}`;
  return [
    `Hi ${recipientName},`,
    ``,
    `${changedByName} has changed your role on "${documentTitle}" from ${ROLE_LABELS[oldRole] ?? oldRole} to ${ROLE_LABELS[newRole] ?? newRole}.`,
    ``,
    `Open the document: ${docUrl}`,
    ``,
    `— DocEditor`,
  ].join("\n");
}
