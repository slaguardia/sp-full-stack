import type { Metadata } from "next";
import {
  Big_Shoulders_Stencil,
  Archivo,
  DM_Mono,
} from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "@/components/nav";

const stencil = Big_Shoulders_Stencil({
  subsets: ["latin"],
  variable: "--font-stencil",
  weight: ["400", "600", "700", "800", "900"],
  display: "swap",
  adjustFontFallback: false,
});

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["300", "400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FSC // Supply Corps — Classification Depot",
  description:
    "Route a company to its Federal Supply Classification codes. Prototype ordnance not included.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${stencil.variable} ${archivo.variable} ${dmMono.variable}`}
    >
      <body className="paper-bg">
        <Providers>
          <Nav />
          <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-6 sm:px-8 lg:px-12">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
