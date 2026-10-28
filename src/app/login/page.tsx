import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <AuthShell
      title="Đăng nhập"
      description="Đăng nhập để tiếp tục với Creative Hub"
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Chưa có tài khoản?{" "}
          <Link href="/register" className="font-medium text-[#5b85ff] hover:underline">
            Đăng ký
          </Link>
        </p>
      }
    >
      <LoginForm redirectTo={next} />
    </AuthShell>
  );
}
