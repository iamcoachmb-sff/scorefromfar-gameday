import type { Metadata } from "next";
import PwaRegister from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "Score From Far Call Sheet",
  description: "Offline-ready live play calling dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
