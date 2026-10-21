import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kantin Gozeal · Sistem Manajemen Jatah Makanan & Minuman Karyawan",
  description: "Sistem Manajemen Jatah Makanan & Minuman Karyawan Kantin Gozeal",
  keywords: ["Kantin Gozeal", "kantin", "karyawan", "makanan", "minuman"],
  authors: [{ name: "Kantin Gozeal" }],
  icons: {
    icon: "/gozeal-logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <SonnerToaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
