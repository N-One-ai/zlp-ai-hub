"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Check } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setActiveWorkspace } from "@/lib/workspace/actions";
import type { WorkspaceMembership } from "@/types/workspace";

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
}: {
  workspaces: WorkspaceMembership[];
  activeWorkspaceId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const active = workspaces.find((w) => w.workspaceId === activeWorkspaceId);

  function handleSelect(workspaceId: string) {
    if (workspaceId === activeWorkspaceId) return;
    startTransition(async () => {
      const result = await setActiveWorkspace(workspaceId);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  if (workspaces.length <= 1) {
    return <span className="text-sm font-semibold truncate">{active?.workspaceName ?? "Workspace"}</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        className="flex items-center gap-1.5 text-sm font-semibold truncate outline-none"
      >
        <span className="truncate">{active?.workspaceName ?? "Workspace"}</span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.workspaceId} onClick={() => handleSelect(w.workspaceId)}>
            <span className="flex-1 truncate">{w.workspaceName}</span>
            {w.workspaceId === activeWorkspaceId && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
