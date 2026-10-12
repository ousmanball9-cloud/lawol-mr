import Link from "next/link";
import { Chrome } from "@/components/chrome/chrome";

const SECTIONS = [
  { id: "eligibilite", num: "01", titre: "Trouver la bonne bourse" },
  { id: "dossier", num: "02", titre: "Le dossier type" },
  { id: "lettre", num: "03", titre: "La lettre de motivation" },
  { id: "pieges", num: "04", titre: "Les pièges à éviter" },
  { id: "calendrier", num: "05", titre: "Calendrier" },
  { id: "rester-informe", num: "06", titre: "Rester informé" },
] as const;

/** Page conseils — contenu statique de confiance (aucun fetch, aucun chiffre promis). */
export default function ConseilsPage() {
  return (
    <Chrome>
      <div className="px-4 py-16">
        <div className="mx-auto max-w-3xl">
          {/* En-tête */}
          <p className="eyebrow mb-3 text-signature">Guide pratique</p>
          <h1 className="mb-4 font-display text-3xl font-bold tracking-[-0.02em] text-ink sm:text-4xl">
            Conseils bourses : postuler sereinement
          </h1>
          <p className="mb-8 leading-relaxed text-muted-foreground">
            Des conseils honnêtes et concrets pour préparer vos candidatures : vérifier
            votre éligibilité, constituer un dossier complet, écrire une lettre qui
            compte, et repérer les arnaques. Rien de compliqué — de la méthode, de
            l&apos;anticipation, et une vérification systématique des sources
            officielles.
          </p>

          {/* Ancres rapides */}
          <nav
            aria-label="Sommaire de la page"
            className="mb-10 flex flex-wrap gap-2 border-y border-border py-4"
          >
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:border-signature/40 hover:text-foreground"
              >
                <span aria-hidden="true" className="mr-1.5 text-signature">
                  {s.num}
                </span>
                {s.titre}
              </a>
            ))}
          </nav>

          <div className="space-y-6">
            {/* 1. Éligibilité */}
            <section
              id="eligibilite"
              className="scroll-mt-24 rounded-xl border border-border bg-card p-6 sm:p-8"
            >
              <p className="eyebrow mb-3 text-muted-foreground">01 — Avant tout</p>
              <h2 className="mb-4 font-display text-xl font-bold tracking-[-0.01em] text-ink sm:text-2xl">
                Comment trouver la bourse faite pour vous
              </h2>
              <ul className="space-y-3 text-sm leading-relaxed text-ink/80 sm:text-base">
                <li className="flex gap-3">
                  <span aria-hidden="true" className="text-signature">→</span>
                  <span>
                    <strong className="text-ink">Vérifiez l&apos;éligibilité en premier</strong>{" "}
                    : filière, niveau d&apos;étude, nationalité, âge. Une bourse pour
                    laquelle vous n&apos;êtes pas éligible vous coûte du temps — passez
                    à la suivante.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span aria-hidden="true" className="text-signature">→</span>
                  <span>
                    <strong className="text-ink">La date limite avant tout le reste</strong>{" "}
                    : si l&apos;échéance est passée, inutile de lire la suite. Notez-la
                    immédiatement.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span aria-hidden="true" className="text-signature">→</span>
                  <span>
                    <strong className="text-ink">La source officielle uniquement</strong>{" "}
                    : site de l&apos;établissement, du bailleur de fonds ou de
                    l&apos;administration concernée. Les informations recopiées sur les
                    réseaux sociaux datent souvent de l&apos;année précédente.
                  </span>
                </li>
              </ul>
            </section>

            {/* 2. Dossier */}
            <section
              id="dossier"
              className="scroll-mt-24 rounded-xl border border-border bg-card p-6 sm:p-8"
            >
              <p className="eyebrow mb-3 text-muted-foreground">02 — Pièces à réunir</p>
              <h2 className="mb-4 font-display text-xl font-bold tracking-[-0.01em] text-ink sm:text-2xl">
                Le dossier type
              </h2>
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                La plupart des dossiers demandent les mêmes pièces. Préparez-les une fois,
                en format numérique propre (PDF, lisibles), et vous gagnerez des jours :
              </p>
              <ul className="mb-4 grid gap-2 text-sm leading-relaxed text-ink/80 sm:grid-cols-2 sm:text-base">
                <li className="rounded-lg border border-border bg-background px-3 py-2">
                  CV à jour
                </li>
                <li className="rounded-lg border border-border bg-background px-3 py-2">
                  Relevés de notes
                </li>
                <li className="rounded-lg border border-border bg-background px-3 py-2">
                  Lettre de motivation
                </li>
                <li className="rounded-lg border border-border bg-background px-3 py-2">
                  Passeport ou copie de la CIN
                </li>
              </ul>
              <p className="text-sm leading-relaxed text-ink/80 sm:text-base">
                Anticipez : certains documents (extraits, traductions, attestations) prennent
                du temps à obtenir. <strong className="text-ink">Ne rien laisser au dernier
                jour</strong> — c&apos;est la première cause de dossier incomplet.
              </p>
            </section>

            {/* 3. Lettre */}
            <section
              id="lettre"
              className="scroll-mt-24 rounded-xl border border-border bg-card p-6 sm:p-8"
            >
              <p className="eyebrow mb-3 text-muted-foreground">03 — Rédaction</p>
              <h2 className="mb-4 font-display text-xl font-bold tracking-[-0.01em] text-ink sm:text-2xl">
                Écrire une bonne lettre de motivation
              </h2>
              <ol className="mb-4 space-y-3 text-sm leading-relaxed text-ink/80 sm:text-base">
                <li className="flex gap-3">
                  <span aria-hidden="true" className="text-signature">1.</span>
                  <span>
                    <strong className="text-ink">Structure claire</strong> : votre parcours,
                    votre projet, puis l&apos;adéquation entre les deux et cette bourse.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span aria-hidden="true" className="text-signature">2.</span>
                  <span>
                    <strong className="text-ink">Adaptée à chaque bourse</strong> : une
                    lettre générique se repère immédiatement. Parlez de ce que vous visez
                    réellement.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span aria-hidden="true" className="text-signature">3.</span>
                  <span>
                    <strong className="text-ink">Relecture obligatoire</strong> : une
                    personne de confiance, et une vérification orthographe. Les fautes
                    discréditent un dossier sérieux.
                  </span>
                </li>
              </ol>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                Court et sincère vaut mieux qu&apos;un long texte impersonnel.
              </p>
            </section>

            {/* 4. Pièges */}
            <section
              id="pieges"
              className="scroll-mt-24 rounded-xl border border-border bg-card p-6 sm:p-8"
            >
              <p className="eyebrow mb-3 text-muted-foreground">04 — Attention</p>
              <h2 className="mb-4 font-display text-xl font-bold tracking-[-0.01em] text-ink sm:text-2xl">
                Les pièges à éviter
              </h2>
              <ul className="space-y-3 text-sm leading-relaxed text-ink/80 sm:text-base">
                <li className="flex gap-3">
                  <span aria-hidden="true" className="text-surlignage">!</span>
                  <span>
                    <strong className="text-ink">Les « frais de dossier »</strong> : une
                    vraie bourse ne fait <em>jamais</em> payer pour postuler. Aucun frais,
                    aucune « caution », aucun « frais de traitement ».
                  </span>
                </li>
                <li className="flex gap-3">
                  <span aria-hidden="true" className="text-surlignage">!</span>
                  <span>
                    <strong className="text-ink">Les liens non officiels</strong> : méfiez-vous
                    des pages qui collectent vos documents hors du site officiel de la
                    bourse.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span aria-hidden="true" className="text-surlignage">!</span>
                  <span>
                    <strong className="text-ink">L&apos;urgence artificielle</strong> :
                    « il reste 2 heures », « dernière chance » : la pression est une
                    technique de vente, pas un processus de sélection sérieux.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span aria-hidden="true" className="text-surlignage">!</span>
                  <span>
                    <strong className="text-ink">Les dates dépassées</strong> : vérifiez
                    toujours que l&apos;annonce est à jour — une annonce périmée circule
                    longtemps sur le web.
                  </span>
                </li>
              </ul>
              <p className="mt-5 border-l-2 border-surlignage bg-surlignage/10 px-4 py-3 text-sm leading-relaxed text-ink">
                En cas de doute, revenez à la source officielle de la bourse. Et si une
                annonce vous semble douteuse, signalez-la-nous via la{" "}
                <Link
                  href="/contact"
                  className="text-signature underline underline-offset-4 hover:text-signature-deep"
                >
                  page contact
                </Link>
                .
              </p>
            </section>

            {/* 5. Calendrier */}
            <section
              id="calendrier"
              className="scroll-mt-24 rounded-xl border border-border bg-card p-6 sm:p-8"
            >
              <p className="eyebrow mb-3 text-muted-foreground">05 — Organisation</p>
              <h2 className="mb-4 font-display text-xl font-bold tracking-[-0.01em] text-ink sm:text-2xl">
                Calendrier : postuler tôt, suivre ses échéances
              </h2>
              <ul className="space-y-3 text-sm leading-relaxed text-ink/80 sm:text-base">
                <li className="flex gap-3">
                  <span aria-hidden="true" className="text-signature">→</span>
                  <span>
                    <strong className="text-ink">Postulez tôt</strong> : déposer en avance
                    laisse le temps de corriger un document manquant ou illisible.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span aria-hidden="true" className="text-signature">→</span>
                  <span>
                    <strong className="text-ink">Suivez vos échéances</strong> : sur LAWOL,
                    chaque offre affiche un badge <strong className="text-ink">J-x</strong>{" "}
                    pour indiquer le nombre de jours restants avant la date limite.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span aria-hidden="true" className="text-signature">→</span>
                  <span>
                    <strong className="text-ink">Gardez une trace</strong> : utilisez le
                    coffre-fort de documents pour vos pièces, et le suivi de candidature pour
                    savoir où vous en êtes — sans quoi tout se perd entre deux dossiers.
                  </span>
                </li>
              </ul>
            </section>

            {/* 6. Rester informé */}
            <section
              id="rester-informe"
              className="scroll-mt-24 rounded-xl border border-border bg-card p-6 sm:p-8"
            >
              <p className="eyebrow mb-3 text-muted-foreground">06 — Sur LAWOL</p>
              <h2 className="mb-4 font-display text-xl font-bold tracking-[-0.01em] text-ink sm:text-2xl">
                Rester informé
              </h2>
              <p className="mb-5 text-sm leading-relaxed text-ink/80 sm:text-base">
                Chercher une bourse régulièrement prend du temps. Un profil LAWOL (filière,
                niveau, ville, types d&apos;opportunités) permet de recevoir uniquement les
                alertes qui vous correspondent — et de ne pas rater une échéance parce
                qu&apos;une annonce est passée sous votre radar.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/inscription"
                  className="rounded-lg bg-signature px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-signature-deep"
                >
                  Créer mon profil
                </Link>
                <Link
                  href="/offres"
                  className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors duration-150 hover:border-signature/40 hover:text-signature"
                >
                  Consulter les offres
                </Link>
              </div>
            </section>
          </div>

          {/* Note de transparence */}
          <p className="mt-8 border-t border-border pt-6 text-sm leading-relaxed text-muted-foreground">
            Ces conseils sont indicatifs : chaque bourse a ses propres règles, qui
            font foi. Vérifiez toujours les conditions sur la source officielle de
            la bourse visée.
          </p>
        </div>
      </div>
    </Chrome>
  );
}
