import type { Metadata } from "next";
import { Be_Vietnam_Pro, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

// Aeonik Pro — Creative Hub's brand typeface (brand guideline default, see
// src/lib/brand/fonts.ts). Self-hosted via next/font/local from the files
// in public/fonts/aeonik-pro/ (licensed files supplied by the team — see
// that folder's README). next/font/local also generates a size-adjusted
// fallback face automatically, which keeps line-height/button-height from
// jumping around while this font loads.
const aeonikPro = localFont({
  variable: "--font-aeonik-pro",
  display: "swap",
  src: [
    { path: "../../public/fonts/aeonik-pro/AeonikPro-Light.otf", weight: "300", style: "normal" },
    { path: "../../public/fonts/aeonik-pro/AeonikPro-LightItalic.otf", weight: "300", style: "italic" },
    { path: "../../public/fonts/aeonik-pro/AeonikPro-Regular.otf", weight: "400", style: "normal" },
    { path: "../../public/fonts/aeonik-pro/AeonikPro-RegularItalic.otf", weight: "400", style: "italic" },
    { path: "../../public/fonts/aeonik-pro/AeonikPro-Medium.otf", weight: "500", style: "normal" },
    { path: "../../public/fonts/aeonik-pro/AeonikPro-MediumItalic.otf", weight: "500", style: "italic" },
    { path: "../../public/fonts/aeonik-pro/AeonikPro-Bold.otf", weight: "700", style: "normal" },
    { path: "../../public/fonts/aeonik-pro/AeonikPro-BoldItalic.otf", weight: "700", style: "italic" },
    { path: "../../public/fonts/aeonik-pro/AeonikPro-Black.otf", weight: "900", style: "normal" },
    { path: "../../public/fonts/aeonik-pro/AeonikPro-BlackItalic.otf", weight: "900", style: "italic" },
  ],
});

// Be Vietnam Pro — fallback behind Aeonik Pro, kept specifically for full
// Vietnamese diacritic coverage (Aeonik Pro's Latin-only glyph set doesn't
// cover Vietnamese diacritics) per the design brief's "hỗ trợ tiếng Việt
// đầy đủ" requirement.
const vnFallback = Be_Vietnam_Pro({
  variable: "--font-vn-fallback",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Creative Hub",
  description: "Tạo, quản lý và tải xuống hình ảnh marketing đúng nhận diện thương hiệu.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${aeonikPro.variable} ${vnFallback.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
