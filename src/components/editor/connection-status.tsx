"use client";

import { Wifi, WifiOff, RefreshCw, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { useOnlineStatus } from "@/hooks/use-online-status";

export function ConnectionStatus() {
  const isOnline = useOnlineStatus();
  const { connectionStatus, syncError } = useEditorStore();

  const status = !isOnline
    ? "offline"
    : connectionStatus === "syncing"
      ? "syncing"
      : connectionStatus === "connected"
        ? "connected"
        : "online";

  const config = {
    offline: {
      icon: WifiOff,
      label: "Offline",
      className: "text-amber-500 bg-amber-500/10",
    },
    syncing: {
      icon: RefreshCw,
      label: "Syncing",
      className: "text-blue-500 bg-blue-500/10",
    },
    connected: {
      icon: Cloud,
      label: "Live",
      className: "text-emerald-500 bg-emerald-500/10",
    },
    online: {
      icon: Wifi,
      label: "Online",
      className: "text-emerald-500 bg-emerald-500/10",
    },
  }[status];

  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        config.className,
      )}
      title={syncError ?? undefined}
    >
      <Icon className={cn("h-3.5 w-3.5", status === "syncing" && "animate-spin")} />
      {config.label}
    </div>
  );
}
