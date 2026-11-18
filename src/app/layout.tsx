import type { Metadata, Viewport } from "next";
import { asset } from "@/lib/asset";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "RC Engineering OS",
  description: "Centro de control de proyectos de ingeniería, construcción y arquitectura — RC Engineering & Technology Group.",
  icons: { icon: asset("/branding/rc-isotype.svg") },
};

export const viewport: Viewport = {
  themeColor: "#f3f6f4",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CO" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
