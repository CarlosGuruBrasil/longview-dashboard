import type { Metadata, Viewport } from "next";
import "./globals.css";
import { UserProvider } from "@/context/UserContext";

export const metadata: Metadata = {
  title: "LongView Manager",
  description: "Gestão Operacional Imobiliária",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico",   sizes: "any" },
      { url: "/icon-192.png",  sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png",  sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LongView",
    startupImage: "/icon-512.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className="antialiased dark"
      style={{ colorScheme: "dark" }}
      suppressHydrationWarning
    >
      <body
        className="bg-[#09090b] text-zinc-100 selection:bg-white/10 selection:text-white"
        suppressHydrationWarning
      >
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}
