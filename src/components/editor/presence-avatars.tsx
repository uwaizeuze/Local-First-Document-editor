"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditorStore } from "@/stores/editor-store";

export function PresenceAvatars() {
  const { presenceUsers } = useEditorStore();

  if (presenceUsers.length === 0) return null;

  return (
    <div className="flex -space-x-2">
      {presenceUsers.slice(0, 5).map((user) => (
        <Tooltip key={user.id}>
          <TooltipTrigger asChild>
            <Avatar
              className="h-7 w-7 border-2 border-background"
              style={{ borderColor: user.color }}
            >
              <AvatarFallback
                style={{ backgroundColor: user.color ?? "#60a5fa", color: "#fff" }}
                className="text-[10px]"
              >
                {user.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>{user.name}</TooltipContent>
        </Tooltip>
      ))}
      {presenceUsers.length > 5 && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
          +{presenceUsers.length - 5}
        </span>
      )}
    </div>
  );
}
