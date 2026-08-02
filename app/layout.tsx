import type { Metadata } from "next";
import { spaceGrotesk, plexSans, plexMono } from "@/lib/fonts";
import "./globals.css";
import NavBar from "./components/NavBar";

export const metadata: Metadata = {
  title: "Room Renovation AI",
  description: "Upload a room photo and get AI-generated renovation ideas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper font-body text-ink">
        <NavBar />
        {children}
      </body>
    </html>
  );
}