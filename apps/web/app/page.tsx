import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  MessageSquare, CheckCircle, Clock, Shield,
  GraduationCap, Briefcase, Zap, ArrowRight,
  Sparkles, Target, Users, Bell,
} from "lucide-react"

const WHATSAPP_URL = "https://wa.me/222XXXXXXXX?text=Bonjour%20LAWOL%2C%20je%20veux%20recevoir%20les%20offres%20qui%20matchent%20mon%20profil."

const STEPS = [
  {
    num: "01",
    icon: GraduationCap,
    title: "Crée ton profil",
    desc: "Remplis un court formulaire : filière, niveau, ville, type d'offre recherché. 2 minutes chrono.",
  },
  {
    num: "02",
    icon: Zap,
    title: "On trouve pour toi",
    desc: "Nos robots scannent LinkedIn, sites entreprises, ANPE et universités. Le matching est automatique et instantané.",
  },
  {
    num: "03",
    icon: MessageSquare,
    title: "Reçois sur WhatsApp",
    desc: "Seules les offres qui matchent ton profil arrivent sur ton WhatsApp. Tu postules en un clic.",
  },
]

const AVANTAGES = [
  {
    icon: Target,
    title: "Uniquement le pertinent",
    desc: "Chaque offre est filtrée selon ta filière, ton niveau et ta ville. Aucun bruit, aucune perte de temps.",
  },
  {
    icon: Bell,
    title: "Alerte immédiate",
    desc: "Les offres fraîches arrivent en quelques minutes, avant que les groupes ne soient saturés.",
  },
  {
    icon: Shield,
    title: "Données protégées",
    desc: "Ton numéro reste privé, opt-in clair et désinscription en un clic. Respectueux du RGPD.",
  },
  {
    icon: Clock,
    title: "30 secondes d'inscription",
    desc: "Pas d'application à installer, pas de mot de passe. Un formulaire court et c'est parti.",
  },
  {
    icon: Users,
    title: "100 % gratuit",
    desc: "Un service pensé pour les étudiants mauritaniens, sans frais cachés ni abonnement.",
  },
  {
    icon: Sparkles,
    title: "Sources fiables",
    desc: "ANPE, LinkedIn, universités et grandes entreprises locales : uniquement des sources officielles.",
  },
]

// Badges d'icônes monochromes : zéro rainbow, la couleur signature reste rare.
const TYPES_OFFRES = [
  { icon: GraduationCap, label: "Stage PFE", desc: "Fin d'études, 3-6 mois" },
  { icon: Briefcase, label: "Emploi Junior", desc: "Premier job, 0-2 ans exp." },
  { icon: Zap, label: "Alternance", desc: "Études + travail en entreprise" },
  { icon: Clock, label: "Stage Été", desc: "2-3 mois pendant les vacances" },
]

const SOURCES = [
  "Mauritel", "Chinguitty Bank", "BNM", "SNIM",
  "TotalEnergies", "Ooredoo", "MCM", "BACIM",
  "ANPE", "LinkedIn", "Universités", "Ambassades",
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero — bloc near-black = ancrage premium, accent uniquement sur le CTA */}
      <section className="relative overflow-hidden bg-ink text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
        />
        {/* Slim header : logo texte + entrée connexion */}
        <div className="container relative mx-auto flex items-center justify-between px-4 py-5">
          <Link href="/" className="text-lg font-bold tracking-[-0.02em] text-white">
            LAWOL.mr
          </Link>
          <Link href="/connexion">
            <Button
              variant="outline"
              className="h-10 rounded-lg border-white/25 bg-transparent px-4 text-sm text-white hover:border-white/50 hover:bg-white/5 hover:text-white"
            >
              Se connecter
            </Button>
          </Link>
        </div>
        <div className="container relative mx-auto px-4 py-24 lg:py-32">
          {/* Conteneur du hero : mesure desktop (verify-design) via data-probe */}
          <div data-probe="hero-conteneur" className="mx-auto max-w-3xl text-center lg:max-w-6xl">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-surlignage" />
              <span>Nouveau : offres PFE directement sur WhatsApp</span>
            </div>

            <h1 className="mb-6 font-display text-[clamp(2.5rem,6vw,4rem)] font-bold leading-[1.06] tracking-[-0.03em] lg:text-[clamp(4rem,6vw,5.5rem)]">
              Ton stage PFE, <br />
              <span className="box-decoration-clone rounded bg-surlignage px-2 pb-1 text-ink">
                sans le stress
              </span>
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-white/70 lg:max-w-3xl">
              LAWOL.mr t&apos;envoie uniquement les offres de stage, emploi junior et alternance
              qui correspondent à <strong className="font-semibold text-white">ton profil</strong> —
              directement sur WhatsApp. Fini la veille quotidienne, les groupes saturés et les offres
              ratées.
            </p>

            <div className="mb-4 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="h-12 w-full rounded-lg bg-signature px-6 text-base text-white hover:bg-signature-deep sm:w-auto"
                  asChild
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Recevoir les offres sur WhatsApp
                    <ArrowRight className="h-5 w-5" />
                  </span>
                </Button>
              </a>
              <Link href="#comment-ca-marche" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 w-full rounded-lg border-white/25 bg-transparent px-6 text-base text-white hover:border-white/50 hover:bg-white/5 hover:text-white sm:w-auto"
                >
                  Comment ça marche
                </Button>
              </Link>
            </div>

            <div className="mb-10 text-sm text-white/70">
              <Link
                href="/connexion"
                className="underline underline-offset-4 transition-colors duration-150 hover:text-white"
              >
                Déjà inscrit ? Connecte-toi
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-white/70">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                <CheckCircle className="h-4 w-4 text-white/60" />
                <span>100% gratuit pour les étudiants</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                <Shield className="h-4 w-4 text-white/60" />
                <span>Données protégées (RGPD)</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                <Clock className="h-4 w-4 text-white/60" />
                <span>Inscription en 30 secondes</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section id="comment-ca-marche" className="bg-background py-24 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <p className="eyebrow mb-4 text-signature">
              Simple, rapide, sans application
            </p>
            <h2 className="mb-4 font-display text-3xl font-bold tracking-[-0.02em] text-ink lg:text-4xl">
              Comment ça marche en <span className="text-signature">3 étapes</span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              De l&apos;inscription à la première offre, tout se passe sur WhatsApp.
            </p>
          </div>

          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3 lg:max-w-6xl">
            {STEPS.map((step) => (
              <div
                key={step.num}
                className="relative rounded-lg border border-border bg-card p-7 transition-colors duration-200 hover:border-signature"
              >
                <span className="eyebrow absolute right-6 top-7 text-muted-foreground">
                  {step.num}
                </span>
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-background text-ink">
                  <step.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-semibold tracking-[-0.01em] text-ink">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pourquoi LAWOL.mr */}
      <section className="border-y border-border bg-card py-24 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <p className="eyebrow mb-4 text-signature">
              Veille d&apos;offres automatique
            </p>
            <h2 className="mb-4 font-display text-3xl font-bold tracking-[-0.02em] text-ink lg:text-4xl">
              Pourquoi <span className="text-signature">LAWOL.mr</span> ?
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Une veille d&apos;offres qui travaille à ta place, chaque jour.
            </p>
          </div>

          <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:max-w-7xl lg:grid-cols-3">
            {AVANTAGES.map((item) => (
              <div
                key={item.title}
                className="group rounded-lg border border-border bg-card p-6 transition-colors duration-200 hover:border-signature"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background text-ink transition-colors duration-200 group-hover:border-signature group-hover:text-signature">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-ink">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Types d'offres */}
      <section className="bg-background py-24 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <p className="eyebrow mb-4 text-signature">
              Tous les formats
            </p>
            <h2 className="mb-4 font-display text-3xl font-bold tracking-[-0.02em] text-ink lg:text-4xl">
              Tous types d&apos;opportunités pour <span className="text-signature">ton profil</span>
            </h2>
          </div>

          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:max-w-6xl lg:grid-cols-4">
            {TYPES_OFFRES.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-border bg-card p-6 transition-colors duration-200 hover:border-signature"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-ink text-white">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-1 text-lg font-semibold text-ink">{item.label}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sources */}
      <section className="border-y border-border bg-card py-24 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <p className="eyebrow mb-4 text-signature">
              Partenaires &amp; sources officielles
            </p>
            <h2 className="mb-4 font-display text-3xl font-bold tracking-[-0.02em] text-ink lg:text-4xl">
              Nos sources <span className="text-signature">fiables &amp; officielles</span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Des canaux vérifiés, mis à jour automatiquement.
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2 lg:max-w-6xl lg:grid-cols-4">
            {SOURCES.map((src) => (
              <div
                key={src}
                className="rounded-lg border border-border bg-card px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors duration-200 hover:border-signature hover:text-ink"
              >
                {src}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final — bloc near-black, accent uniquement sur le bouton */}
      <section className="bg-background py-24 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl rounded-lg bg-ink px-8 py-12 text-center lg:max-w-5xl lg:px-14 lg:py-16">
            <h2 className="mb-4 font-display text-3xl font-bold tracking-[-0.02em] text-white lg:text-4xl">
              Prêt à ne plus rater aucune offre ?
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-lg text-white/70">
              Rejoins des centaines d&apos;étudiants mauritaniens qui reçoivent déjà leurs offres
              matchées sur WhatsApp.
            </p>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-block w-full sm:w-auto">
              <Button
                size="lg"
                className="h-12 w-full rounded-lg bg-signature px-6 text-base text-white hover:bg-signature-deep sm:w-auto"
                asChild
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Commencer gratuitement sur WhatsApp
                  <ArrowRight className="h-5 w-5" />
                </span>
              </Button>
            </a>
            <p className="mt-5 text-sm text-white/60">
              En cliquant, tu ouvres WhatsApp avec un message pré-rempli. Aucune donnée
              n&apos;est collectée avant ton accord.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="container mx-auto px-4 py-14">
          <div className="mb-10 grid gap-10 md:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">
                  L
                </span>
                <span className="text-lg font-bold tracking-[-0.02em] text-ink">LAWOL.mr</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                La plateforme qui connecte les étudiants mauritaniens aux opportunités qui leur
                correspondent.
              </p>
            </div>
            <div>
              <h4 className="eyebrow mb-4 text-ink">
                Liens
              </h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li>
                  <Link href="/mentions" className="transition-colors duration-150 hover:text-signature">
                    Mentions légales
                  </Link>
                </li>
                <li>
                  <Link href="/confidentialite" className="transition-colors duration-150 hover:text-signature">
                    Confidentialité
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="transition-colors duration-150 hover:text-signature">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="eyebrow mb-4 text-ink">
                Pour les étudiants
              </h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li>Recevoir les offres</li>
                <li>Modifier mon profil</li>
                <li>Se désinscrire</li>
              </ul>
            </div>
            <div>
              <h4 className="eyebrow mb-4 text-ink">
                Pour les entreprises
              </h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li>Publier une offre</li>
                <li>Espace recruteur</li>
                <li>Partenariat</li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border pt-8 text-center text-sm text-muted-foreground sm:flex-row sm:text-left">
            <p>© 2024 LAWOL.mr — Tous droits réservés.</p>
            <p>Fait avec ❤️ pour les étudiants mauritaniens.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
