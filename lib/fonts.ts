import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

// IMPORTANT: these variable names must be DIFFERENT from the --font-display
// / --font-body / --font-mono tokens used in globals.css's @theme block.
// Reusing the same name there creates a circular CSS variable reference
// (var(--font-display) pointing to itself), which can silently break the
// whole @theme block — that was the bug that caused zero Tailwind styling
// to apply at all.

export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--ff-display",
  display: "swap",
});

export const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--ff-body",
  display: "swap",
});

export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--ff-mono",
  display: "swap",
});