import Link from "next/link";

const COLONNES = [
  {
    titre: "Étudiants",
    liens: [
      { href: "/offres", label: "Offres" },
      { href: "/inscription", label: "S'inscrire" },
      { href: "/connexion", label: "Se connecter" },
    ],
  },
  {
    titre: "Ressources",
    liens: [
      { href: "/contact", label: "Contact" },
      { href: "/conseils", label: "Conseils bourses" },
      { href: "/mentions", label: "Mentions légales" },
      { href: "/conditions", label: "Conditions" },
      { href: "/confidentialite", label: "Confidentialité" },
    ],
  },
  {
    titre: "LAWOL.mr",
    liens: [
      { href: "/offres", label: "Toutes les offres" },
      { href: "/#comment-ca-marche", label: "Comment ça marche" },
      { href: "/#organisations", label: "Nos sources" },
    ],
  },
];

/** Footer global — pattern Jobteaser : fond sombre, 4 colonnes de liens. */
export function Footer() {
  return (
    <footer className="border-t border-border fond-nuit text-white">
      <div className="container mx-auto px-4 py-14">
        <div className="mb-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {COLONNES.map((col) => (
            <div key={col.titre}>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-white/60">
                {col.titre}
              </h4>
              <ul className="space-y-2.5 text-sm">
                {col.liens.map((lien, i) => (
                  <li key={`${lien.href}-${i}`}>
                    <Link
                      href={lien.href}
                      className="text-white/70 transition-colors duration-150 hover:text-white"
                    >
                      {lien.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-8 text-center text-sm text-white/50 sm:flex-row sm:text-left">
          <p>© {new Date().getFullYear()} LAWOL.mr — Tous droits réservés.</p>
          <p>Fait pour les étudiants mauritaniens.</p>
        </div>
      </div>
    </footer>
  );
}
