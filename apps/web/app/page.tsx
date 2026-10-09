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

const TYPES_OFFRES = [
  { icon: GraduationCap, label: "Stage PFE", desc: "Fin d'études, 3-6 mois", color: "bg-indigo-500" },
  { icon: Briefcase, label: "Emploi Junior", desc: "Premier job, 0-2 ans exp.", color: "bg-emerald-500" },
  { icon: Zap, label: "Alternance", desc: "Études + travail en entreprise", color: "bg-violet-500" },
  { icon: Clock, label: "Stage Été", desc: "2-3 mois pendant les vacances", color: "bg-sky-500" },
]

const SOURCES = [
  "Mauritel", "Chinguitty Bank", "BNM", "SNIM",
  "TotalEnergies", "Ooredoo", "MCM", "BACIM",
  "ANPE", "LinkedIn", "Universités", "Ambassades",
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/15 via-violet-500/10 to-background">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-violet-400/25 blur-3xl"
        />
        <div className="container relative mx-auto px-4 py-20 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/70 px-4 py-2 text-sm font-medium text-primary shadow-sm backdrop-blur">
              <Zap className="h-4 w-4" />
              <span>Nouveau : Offres PFE directement sur WhatsApp</span>
            </div>

            <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground lg:text-6xl">
              Ton stage PFE, <br />
              <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
                sans le stress
              </span>
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground lg:text-xl">
              LAWOL.mr t&apos;envoie uniquement les offres de stage, emploi junior et alternance
              qui correspondent à <strong className="font-semibold text-foreground">ton profil</strong> —
              directement sur WhatsApp. Fini la veille quotidienne, les groupes saturés et les offres
              ratées.
            </p>

            <div className="mb-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full rounded-xl shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 sm:w-auto"
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
                <Button size="lg" variant="outline" className="w-full rounded-xl bg-background/70 sm:w-auto">
                  Comment ça marche
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 shadow-sm">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>100% gratuit pour les étudiants</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 shadow-sm">
                <Shield className="h-4 w-4 text-primary" />
                <span>Données protégées (RGPD)</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 shadow-sm">
                <Clock className="h-4 w-4 text-primary" />
                <span>Inscription en 30 secondes</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section id="comment-ca-marche" className="bg-muted/30 py-20 lg:py-28">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
              Simple, rapide, sans application
            </p>
            <h2 className="mb-4 text-3xl font-bold text-foreground lg:text-4xl">
              Comment ça marche en <span className="text-primary">3 étapes</span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              De l&apos;inscription à la première offre, tout se passe sur WhatsApp.
            </p>
          </div>

          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className="relative rounded-2xl border bg-card p-7 text-center shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
              >
                <span className="absolute right-5 top-5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                  {step.num}
                </span>
                <div
                  className={`mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl ${
                    i === 0
                      ? "bg-primary/10 text-primary"
                      : i === 1
                        ? "bg-violet-500/10 text-violet-600"
                        : "bg-emerald-500/10 text-emerald-600"
                  }`}
                >
                  <step.icon className="h-8 w-8" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pourquoi LAWOL.mr */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground lg:text-4xl">
              Pourquoi <span className="text-primary">LAWOL.mr</span> ?
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Une veille d&apos;offres qui travaille à ta place, chaque jour.
            </p>
          </div>

          <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {AVANTAGES.map((item) => (
              <div
                key={item.title}
                className="group rounded-2xl border bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Types d'offres */}
      <section className="bg-muted/30 py-20 lg:py-28">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground lg:text-4xl">
              Tous types d&apos;opportunités pour <span className="text-primary">ton profil</span>
            </h2>
          </div>

          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TYPES_OFFRES.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
              >
                <div
                  className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${item.color} text-white shadow-sm`}
                >
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-1 text-lg font-semibold text-foreground">{item.label}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sources */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground lg:text-4xl">
              Nos sources <span className="text-primary">fiables &amp; officielles</span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Des canaux vérifiés, mis à jour automatiquement.
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SOURCES.map((src) => (
              <div
                key={src}
                className="rounded-xl border bg-card p-4 text-center text-sm font-medium text-muted-foreground shadow-sm transition-colors duration-200 hover:border-primary/40 hover:text-foreground"
              >
                {src}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="pb-20 pt-4 lg:pb-28">
        <div className="container mx-auto px-4">
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-violet-600 p-10 text-center shadow-xl lg:p-14">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-white/10 blur-2xl"
            />
            <h2 className="mb-4 text-3xl font-bold text-white lg:text-4xl">
              Prêt à ne plus rater aucune offre ?
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-lg text-white/90">
              Rejoins des centaines d&apos;étudiants mauritaniens qui reçoivent déjà leurs offres
              matchées sur WhatsApp.
            </p>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-block w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full rounded-xl bg-background font-semibold text-foreground shadow-lg transition-all duration-200 hover:bg-background/90 hover:shadow-xl sm:w-auto"
                asChild
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Commencer gratuitement sur WhatsApp
                  <ArrowRight className="h-5 w-5" />
                </span>
              </Button>
            </a>
            <p className="mt-5 text-sm text-white/90">
              En cliquant, tu ouvres WhatsApp avec un message pré-rempli. Aucune donnée
              n&apos;est collectée avant ton accord.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/40">
        <div className="container mx-auto px-4 py-14">
          <div className="mb-10 grid gap-10 md:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-violet-500 text-sm font-bold text-white">
                  L
                </span>
                <span className="text-lg font-bold text-foreground">LAWOL.mr</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                La plateforme qui connecte les étudiants mauritaniens aux opportunités qui leur
                correspondent.
              </p>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
                Liens
              </h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li>
                  <Link href="/mentions" className="transition-colors duration-150 hover:text-primary">
                    Mentions légales
                  </Link>
                </li>
                <li>
                  <Link href="/confidentialite" className="transition-colors duration-150 hover:text-primary">
                    Confidentialité
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="transition-colors duration-150 hover:text-primary">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
                Pour les étudiants
              </h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li>Recevoir les offres</li>
                <li>Modifier mon profil</li>
                <li>Se désinscrire</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
                Pour les entreprises
              </h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li>Publier une offre</li>
                <li>Espace recruteur</li>
                <li>Partenariat</li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col items-center justify-between gap-3 border-t pt-8 text-center text-sm text-muted-foreground sm:flex-row sm:text-left">
            <p>© 2024 LAWOL.mr — Tous droits réservés.</p>
            <p>Fait avec ❤️ pour les étudiants mauritaniens.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
