"use server";

import { createClient } from "@/lib/supabase/server";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { trackEvent } from "@/lib/analytics/track";

const GENERIC_ERROR = "Đã có lỗi xảy ra. Vui lòng thử lại.";

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
}): Promise<ActionResult<{ needsEmailConfirmation: boolean }>> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (!name) return err("VALIDATION_ERROR", "Vui lòng nhập tên của bạn.");
  if (!email.includes("@")) return err("VALIDATION_ERROR", "Email không hợp lệ.");
  if (input.password.length < 6) return err("VALIDATION_ERROR", "Mật khẩu cần ít nhất 6 ký tự.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { data: { name } },
  });

  if (error) {
    console.error("[signUp]", error);
    if (error.message.toLowerCase().includes("already registered")) {
      return err("ALREADY_REGISTERED", "Email này đã được đăng ký.");
    }
    return err("AUTH_ERROR", GENERIC_ERROR);
  }

  // If email confirmation is required, Supabase returns a user but no
  // active session yet — the profile/workspace bootstrap trigger has
  // still already run (it fires on auth.users insert, not on first login).
  return ok({ needsEmailConfirmation: !data.session });
}

export async function signIn(input: { email: string; password: string }): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });

  if (error) {
    return err("INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng.");
  }

  await trackEvent({ name: "login_success" }, { userId: data.user?.id });

  return ok(null);
}

export async function signOut(): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("[signOut]", error);
    return err("AUTH_ERROR", GENERIC_ERROR);
  }
  return ok(null);
}
