import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // field-sizing-content grows the box to fit what's typed — with no
        // cap that means a long pasted prompt can push the whole page
        // layout around it. max-h + overflow-y-auto let it keep growing up
        // to a sane limit, then scroll internally instead (the full value
        // is never touched — this is purely visual, same as any scrollable
        // input). resize-none keeps the native drag-handle from fighting
        // with the auto-sizing (no "resize however you want" vs "I size
        // myself" conflict). Mobile gets a shorter cap than desktop so the
        // controls/submit button below stay reachable without scrolling
        // the whole page first.
        "flex field-sizing-content min-h-16 max-h-[180px] sm:max-h-[240px] resize-none overflow-y-auto w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
