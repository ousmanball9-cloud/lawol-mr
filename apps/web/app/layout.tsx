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

// Facebook SDK — App ID à remplacer par celui de ton app Meta
const FACEBOOK_APP_ID = "1353421643376980";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.fbAsyncInit = function() {
                FB.init({
                  appId      : '${FACEBOOK_APP_ID}',
                  cookie     : true,
                  xfbml      : true,
                  version    : 'v21.0'
                });
                FB.AppEvents.logPageView();
              };
              (function(d, s, id){
                var js, fjs = d.getElementsByTagName(s)[0];
                if (d.getElementById(id)) {return;}
                js = d.createElement(s); js.id = id;
                js.src = "https://connect.facebook.net/en_US/sdk.js";
                fjs.parentNode.insertBefore(js, fjs);
              }(document, 'script', 'facebook-jssdk'));
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
