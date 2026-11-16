/** Zalopay "Z" mark — replaces the generic sparkle separator in the
 * Dashboard marquee (dashboard-marquee.tsx). `fill="currentColor"` (not
 * the original SVG's hardcoded #07eb57) so it follows the same
 * `text-primary` utility every other icon here already uses, instead of
 * a second, slightly-different hardcoded green living in its own file. */
export function ZMarkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 310.91 358.18" fill="currentColor" className={className} aria-hidden="true">
      <path d="M280.11,284.65c-57.4-19.59-110.44-22.91-154.53-19.29l154.53-171.91,30.03-33.4L280.11,0l-3.84,1.57c-4.1,1.68-8.31,3.29-12.51,4.8-34.66,12.48-71.1,18.81-108.31,18.81-41.8,0-82.45-7.94-120.81-23.61L30.79,0,0,61.59l4.4,1.86q13.05,5.52,26.39,10.03c40,13.57,81.81,20.43,124.66,20.43,9.95,0,19.98-.38,29.93-1.13L30.79,264.74.77,298.13l30.02,60.05h0s3.85-1.57,3.85-1.57c4.08-1.67,8.29-3.28,12.5-4.79,34.68-12.49,71.12-18.83,108.31-18.83,41.8,0,82.45,7.95,120.82,23.62l3.84,1.57h0s30.8-61.59,30.8-61.59C300.52,292.07,290.25,288.11,280.11,284.65Z" />
    </svg>
  );
}
