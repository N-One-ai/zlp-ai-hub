import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Đăng nhập</h1>
          <p className="text-sm text-muted-foreground">Đăng nhập để tiếp tục với Creative Hub</p>
        </div>
        <LoginForm redirectTo={next} />
        <p className="text-center text-sm text-muted-foreground">
          Chưa có tài khoản?{" "}
          <Link href="/register" className="font-medium text-foreground underline underline-offset-4">
            Đăng ký
          </Link>
        </p>
      </div>
    </div>
  );
}
