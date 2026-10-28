import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Tạo tài khoản"
      description="Bắt đầu với Creative Hub — workspace đầu tiên của bạn sẽ được tạo tự động."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Đã có tài khoản?{" "}
          <Link href="/login" className="font-medium text-[#5b85ff] hover:underline">
            Đăng nhập
          </Link>
        </p>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
