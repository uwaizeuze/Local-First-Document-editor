import { api } from "@/lib/axios";

export interface DocumentItem {
  id: string;
  title: string;
  updatedAt: string;
  role: string;
}

export interface DocumentMember {
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
  role: "owner" | "editor" | "viewer";
}

export interface LookupUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export const documentService = {
  async getDocuments(page = 1, limit = 10) {
    const response = await api.get("/documents", {
      params: {
        page,
        limit,
      },
    });

    return response.data;
  },

  async createDocument(title: string) {
    const response = await api.post("/documents", {
      title,
    });

    return response.data;
  },

  async deleteDocument(id: string) {
    const response = await api.delete(`/documents/${id}`);
    return response.data;
  },

  async updateDocument(id: string, title: string) {
    const response = await api.patch(`/documents/${id}`, {
      title,
    });

    return response.data;
  },

  async getMembers(documentId: string): Promise<{ members: DocumentMember[] }> {
    const response = await api.get(`/documents/${documentId}/members`);
    return response.data;
  },

  async addMember(documentId: string, email: string, role: "editor" | "viewer") {
    const response = await api.post(`/documents/${documentId}/members`, {
      email,
      role,
    });
    return response.data;
  },

  async removeMember(documentId: string, userId: string) {
    const response = await api.delete(`/documents/${documentId}/members`, {
      data: { userId },
    });
    return response.data;
  },

  async lookupUser(email: string): Promise<{ found: boolean; user?: LookupUser }> {
    const response = await api.get("/users/lookup", { params: { email } });
    return response.data;
  },
};

