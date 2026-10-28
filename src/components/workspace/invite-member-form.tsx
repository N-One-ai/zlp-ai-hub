"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, Info } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inviteMember } from "@/lib/workspace/actions";
import type { MembershipRole } from "@/types/database";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_OPTIONS: { value: MembershipRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "creator", label: "Creator" },
  { value: "viewer", label: "Viewer" },
];

/** Invite form for the Members page. Validates email shape client-side as
 * a UX nicety only — the real validation (account exists, caller is an
 * admin) stays entirely server-side in inviteMember / invite_member. */
export function InviteMemberForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MembershipRole>("creator");
  const [touched, setTouched] = useState(false);
  const [isPending, startTransition] = useTransition();

  const trimmedEmail = email.trim();
  const isValidEmail = EMAIL_RE.test(trimmedEmail);
  const showError = touched && trimmedEmail.length > 0 && !isValidEmail;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (isPending || !isValidEmail) return;
    startTransition(async () => {
      const result = await inviteMember(workspaceId, trimmedEmail, role);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(`Đã mời ${trimmedEmail} vào workspace.`);
      setEmail("");
      setTouched(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1 flex flex-col gap-1.5">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="email@congty.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={showError}
            required
          />
          {showError && <p className="text-xs text-destructive">Email không hợp lệ.</p>}
        </div>
        <div className="flex flex-col gap-1.5 sm:w-36">
          <Label htmlFor="invite-role">Vai trò</Label>
          <Select value={role} onValueChange={(v) => setRole(v as MembershipRole)}>
            <SelectTrigger id="invite-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={isPending || !trimmedEmail || !isValidEmail} className="sm:mt-[22px]">
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          Mời thành viên
        </Button>
      </form>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="size-3.5 shrink-0 translate-y-0.5" />
        Người được mời cần đã có tài khoản Creative Hub (đăng ký trước) để có thể thêm vào workspace.
      </p>
    </div>
  );
}
