"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "sonner";

import { Loader2, FileText, Plus, LogOut, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

import { Footer } from "@/components/layout/footer";
import { formatRelativeTime } from "@/lib/utils";
import { documentService, type DocumentItem } from "@/services/document.service";

interface DashboardClientProps {
  userName: string;
}

export function DashboardClient({ userName }: DashboardClientProps) {
  const router = useRouter();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [page, setPage] = useState(1);

  const [totalPages, setTotalPages] = useState(1);

  const limit = 10;
  const getSerialNumber = (index: number) => {
    return (page - 1) * limit + index + 1;
  };

  useEffect(() => {
    void loadDocuments(page);
  }, [page]);

  const loadDocuments = async (currentPage = page) => {
    try {
      setLoading(true);

      const data = await documentService.getDocuments(currentPage, limit);

      setDocuments(data.documents);
      setTotalPages(data.totalPages);
      setPage(data.page);
    } catch (error: any) {
      toast.error(error.response?.data?.error ?? "Unable to load documents.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    setDeleteInProgress(true);

    try {
      await documentService.deleteDocument(id);
      toast.success("Document deleted successfully.");
      await loadDocuments(page);
    } catch (error: any) {
      toast.error(error.response?.data?.error ?? "Failed to delete document.");
    } finally {
      setDeleteInProgress(false);
      setDeletingDocumentId(null);
    }
  };

  const createDocument = async () => {
    try {
      setCreating(true);

      const data = await documentService.createDocument("Untitled Document");

      toast.success(data.message ?? "Document created successfully.");

      router.push(`/editor/${data.document.id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error ?? "Failed to create document.");
    } finally {
      setCreating(false);
    }
  };

  const handleSignOut = async () => {
    toast.success("Signed out successfully");

    await signOut({
      callbackUrl: "/",
    });
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}

      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <FileText className="text-primary h-6 w-6" />

            <h1 className="text-xl font-bold">DocEditor</h1>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-muted-foreground text-sm">Hi, {userName}</span>

            <Button variant="ghost" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Your Documents</h2>

            <p className="text-muted-foreground mt-1">
              Local-first editing with offline support and real-time collaboration.
            </p>
          </div>

          <Button
            onClick={() => void createDocument()}
            disabled={creating}
            className="cursur pointer"
          >
            {creating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            New Document
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="text-primary h-10 w-10 animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center py-20">
              <FileText className="text-muted-foreground mb-5 h-12 w-12" />

              <h3 className="text-xl font-semibold">No documents found</h3>

              <p className="text-muted-foreground mt-2">
                Create your first collaborative document.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc, index) => (
              <div key={doc.id} className="group relative">
                <Link
                  href={`/editor/${doc.id}`}
                  className="block"
                  onClick={(event) => {
                    if (deletingDocumentId === doc.id || deleteInProgress) {
                      event.preventDefault();
                    }
                  }}
                >
                  <Card className="hover:border-primary cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                    <CardHeader>
                      <CardTitle className="truncate">
                        {doc.title} {getSerialNumber(index)}
                      </CardTitle>
                    </CardHeader>

                    <CardContent>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground text-xs">
                          {formatRelativeTime(doc.updatedAt)}
                        </span>

                        <span className="bg-primary/10 text-primary rounded-full px-2 py-1 text-xs">
                          {doc.role}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                <div className="absolute top-3 right-3 z-10">
                  <Dialog
                    open={deletingDocumentId === doc.id}
                    onOpenChange={(open) => {
                      if (!open) setDeletingDocumentId(null);
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="cursor-pointer"
                        disabled={deleteInProgress}
                        onClick={(event) => {
                          event.stopPropagation();
                          event.preventDefault();
                          setDeletingDocumentId(doc.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>

                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete document?</DialogTitle>
                        <DialogDescription>
                          This action cannot be undone. Are you sure you want to remove{" "}
                          <strong>{doc.title}</strong>?
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline" disabled={deleteInProgress}>
                            Cancel
                          </Button>
                        </DialogClose>
                        <Button
                          variant="destructive"
                          className="cursor-pointer"
                          disabled={deleteInProgress}
                          onClick={() => void handleDeleteDocument(doc.id)}
                        >
                          {deleteInProgress && deletingDocumentId === doc.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          Delete
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 flex justify-center">
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                className="cursor-pointer"
                disabled={page === 1}
                onClick={() => setPage((prev) => prev - 1)}
              >
                Previous
              </Button>

              {Array.from({ length: totalPages }).map((_, index) => (
                <Button
                  key={index}
                  variant={page === index + 1 ? "default" : "outline"}
                  onClick={() => setPage(index + 1)}
                >
                  {index + 1}
                </Button>
              ))}

              <Button
                variant="outline"
                className="cursor-pointer"
                disabled={page === totalPages}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
