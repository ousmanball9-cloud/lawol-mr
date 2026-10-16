import type { Metadata, Viewport } from "next"
import { Inter, Sora } from "next/font/google"
import "./globals.css"
import { FacebookSdk } from "@/components/facebook-sdk"
import { TraceurVisites } from "@/components/vitrine/traceur-visites"
// Texte : Inter (lisibilité FR) — Titres : Sora, display avec caractère.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })
const sora = Sora({ subsets: ["latin"], variable: "--font-display" })
export const metadata: Metadata = {
  title: "LAWOL.mr — Ta bourse, sans le stress",
  description: "La plateforme qui connecte les étudiants mauritaniens aux bourses d'études qui matchent leur profil. Reçois les bourses sur WhatsApp.",
  keywords: ["bourse", "bourses", "études", "Mauritanie", "étudiant", "master", "doctorat"],
  authors: [{ name: "LAWOL.mr" }], creator: "LAWOL.mr", publisher: "LAWOL.mr",
  robots: "index, follow",
  openGraph: { type: "website", locale: "fr_MR", url: "https://lawol-mr.vercel.app", siteName: "LAWOL.mr", title: "LAWOL.mr — Ta bourse, sans le stress", description: "Reçois uniquement les bourses qui matchent ton profil, directement sur WhatsApp." },
  twitter: { card: "summary_large_image", title: "LAWOL.mr — Ta bourse, sans le stress", description: "Reçois uniquement les bourses qui matchent ton profil, directement sur WhatsApp." },
}
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#FAFAFA" }, { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" }], width: "device-width", initialScale: 1, maximumScale: 5 }

// Facebook SDK — App ID à remplacer par celui de ton app Meta.
// Chargé APRÈS hydratation (components/facebook-sdk.tsx) : une balise dans le
// HTML servi était réécrite par le navigateur avant hydratation, ce qui
// déclenchait un avertissement d'hydratation sur TOUTES les pages.
const FACEBOOK_APP_ID = "1353421643376980";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.variable} ${sora.variable} font-sans antialiased`}>
        <TraceurVisites />
        <FacebookSdk appId={FACEBOOK_APP_ID} />
        {children}
      </body>
    </html>
  );
}
