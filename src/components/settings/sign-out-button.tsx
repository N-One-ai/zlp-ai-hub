"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";

/** Same signOut() action and redirect-then-refresh sequence as UserMenu's
 * sign-out item — duplicated here (not extracted into a shared hook)
 * since it's a 6-line handler and the two call sites render completely
 * different triggers (dropdown item vs. a standalone button). */
export function SignOutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      const result = await signOut();
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={handleSignOut} className="w-fit">
      {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
      Đăng xuất
    </Button>
  );
}
