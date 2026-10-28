/** Shared "X / max" character counter for prompt/negative-prompt fields —
 * turns warning-colored past ~90% and destructive-colored once over the
 * limit, so the user sees the constraint before they ever hit submit. */
export function CharCounter({ current, max }: { current: number; max: number }) {
  const over = current > max;
  const near = !over && current >= max * 0.9;
  return (
    <span
      className={`text-xs tabular-nums ${over ? "text-destructive" : near ? "text-warning" : "text-muted-foreground"}`}
    >
      {current.toLocaleString("vi-VN")} / {max.toLocaleString("vi-VN")}
    </span>
  );
}
