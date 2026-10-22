export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function err(code: string, message: string): ActionResult<never> {
  return { ok: false, error: { code, message } };
}
