import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getDocumentById, getDocumentAccess } from "@/lib/db/queries";
import { EditorWorkspace } from "@/components/editor/editor-workspace";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditorPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const access = await getDocumentAccess(id, session.user.id);
  if (!access) notFound();

  const doc = await getDocumentById(id, session.user.id);
  if (!doc) notFound();

  return (
    <EditorWorkspace
      documentId={id}
      initialTitle={doc.title}
      role={access.role}
      user={{
        id: session.user.id,
        name: session.user.name ?? "Anonymous",
      }}
    />
  );
}
