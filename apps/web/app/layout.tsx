import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })
export const metadata: Metadata = {
  title: "LAWOL.mr — Ton stage, sans le stress",
  description: "La plateforme qui connecte les étudiants mauritaniens aux offres de stage PFE, emploi junior et alternance qui matchent leur profil. Reçois les offres sur WhatsApp.",
  keywords: ["stage", "PFE", "emploi", "Mauritanie", "étudiant", "bourse", "alternance"],
  authors: [{ name: "LAWOL.mr" }], creator: "LAWOL.mr", publisher: "LAWOL.mr",
  robots: "index, follow",
  openGraph: { type: "website", locale: "fr_MR", url: "https://lawol.mr", siteName: "LAWOL.mr", title: "LAWOL.mr — Ton stage, sans le stress", description: "Reçois uniquement les offres qui matchent ton profil, directement sur WhatsApp." },
  twitter: { card: "summary_large_image", title: "LAWOL.mr — Ton stage, sans le stress", description: "Reçois uniquement les offres qui matchent ton profil, directement sur WhatsApp." },
}
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "white" }, { media: "(prefers-color-scheme: dark)", color: "#0f172a" }], width: "device-width", initialScale: 1, maximumScale: 5 }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fr" suppressHydrationWarning><body className={`${inter.variable} font-sans antialiased`}>{children}</body></html>
}