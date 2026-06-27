"use client";

import { useEffect } from "react";
import { useAppStore } from "@/stores/editor-store";

export function useOnlineStatus() {
  const { isOnline, setIsOnline } = useAppStore();

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setIsOnline]);

  return isOnline;
}
