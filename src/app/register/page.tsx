import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthGallery } from "@/components/auth/auth-gallery";

export default function RegisterPage() {
  return (
    <div className="relative min-h-svh overflow-hidden">
      <AuthGallery />
      <div className="relative z-10">
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
      </div>
    </div>
  );
}
