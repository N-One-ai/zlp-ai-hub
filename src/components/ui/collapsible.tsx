"use client"

import * as React from "react"
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"
import { cn } from "cn"
import { ChevronDown } from "lucide-react"

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({ className, children, ...props }: CollapsiblePrimitive.Trigger.Props) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      className={cn(
        "group/collapsible-trigger flex w-full items-center justify-between gap-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-md",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]/collapsible-trigger:rotate-180" />
    </CollapsiblePrimitive.Trigger>
  )
}

/**
 * Deliberately NOT animated by height (no `overflow-hidden` + measured
 * `height` transition): base-ui measures the panel's height via JS
 * (`scrollHeight`) at the moment it starts opening, which can run before
 * content that reflows afterward (a `Textarea`'s `field-sizing-content`,
 * wrapped help text, a conditionally-shown input) has settled — any
 * mismatch between that one-shot measurement and the real intrinsic
 * height then clips the panel permanently, not just mid-animation, since
 * the measured pixel height/`overflow-hidden` never get reset back to
 * `auto` in every environment (confirmed: this is what cut off field
 * content and crowded the next accordion up against it). A plain block
 * with no height constraint always grows to its true content height, so
 * clipping/overlap is structurally impossible; the fade is opacity-only
 * (never affects box size) for a touch of motion without reintroducing
 * the risk. */
function CollapsiblePanel({ className, keepMounted = true, ...props }: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-panel"
      keepMounted={keepMounted}
      className={cn("transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0", className)}
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsiblePanel }
