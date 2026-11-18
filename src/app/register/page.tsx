import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthPageLayout } from "@/components/auth/auth-page-layout";

export default function RegisterPage() {
  return (
    <AuthPageLayout>
      <AuthShell
        title="Tạo tài khoản"
        description="Bắt đầu với Creative Hub — workspace đầu tiên của bạn sẽ được tạo tự động."
        footer={
          <p className="text-center text-sm text-muted-foreground">
            Đã có tài khoản?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Đăng nhập
            </Link>
          </p>
        }
      >
        <RegisterForm />
      </AuthShell>
    </AuthPageLayout>
  );
}
