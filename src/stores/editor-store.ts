import { create } from "zustand";

export type ConnectionStatus = "online" | "offline" | "syncing" | "connected" | "disconnected";

export interface PresenceUser {
  id: string;
  name: string;
  color?: string;
}

interface EditorStore {
  connectionStatus: ConnectionStatus;
  presenceUsers: PresenceUser[];
  isVersionSidebarOpen: boolean;
  isAiSidebarOpen: boolean;
  isMembersPanelOpen: boolean;
  syncError: string | null;
  lastSyncedAt: Date | null;

  setConnectionStatus: (status: ConnectionStatus) => void;
  setPresenceUsers: (users: PresenceUser[]) => void;
  setVersionSidebarOpen: (open: boolean) => void;
  setAiSidebarOpen: (open: boolean) => void;
  setMembersPanelOpen: (open: boolean) => void;
  setSyncError: (error: string | null) => void;
  setLastSyncedAt: (date: Date | null) => void;
  reset: () => void;
}

const initialState = {
  connectionStatus: "online" as ConnectionStatus,
  presenceUsers: [] as PresenceUser[],
  isVersionSidebarOpen: false,
  isAiSidebarOpen: false,
  isMembersPanelOpen: false,
  syncError: null as string | null,
  lastSyncedAt: null as Date | null,
};

export const useEditorStore = create<EditorStore>((set) => ({
  ...initialState,
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setPresenceUsers: (presenceUsers) => set({ presenceUsers }),
  setVersionSidebarOpen: (isVersionSidebarOpen) => set({ isVersionSidebarOpen }),
  setAiSidebarOpen: (isAiSidebarOpen) => set({ isAiSidebarOpen }),
  setMembersPanelOpen: (isMembersPanelOpen) => set({ isMembersPanelOpen }),
  setSyncError: (syncError) => set({ syncError }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  reset: () => set(initialState),
}));

interface AppStore {
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  isOnline: true,
  setIsOnline: (isOnline) => set({ isOnline }),
}));
