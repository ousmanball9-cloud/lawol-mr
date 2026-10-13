import Link from "next/link"
import { Button } from "@/components/ui/button"
import { HeroSearch } from "@/components/landing/hero-search"
import { Compteurs, Organisations } from "@/components/landing/compteurs"
import { Header } from "@/components/chrome/header"
import { Footer } from "@/components/chrome/footer"
import {
  CheckCircle, Clock, Shield,
  GraduationCap, Zap, ArrowRight, Award,
  Sparkles, Target, Users, Bell,
} from "lucide-react"

const STEPS = [
  {
    num: "01",
    icon: GraduationCap,
    title: "Crée ton profil",
    desc: "Remplis un court formulaire : filière, niveau, ville, type d'opportunité recherché.",
  },
  {
    num: "02",
    icon: Zap,
    title: "On trouve pour toi",
    desc: "On suit les portails de bourses et les sites d'annonces. Le matching avec ton profil est automatique.",
  },
  {
    num: "03",
    icon: Bell,
    title: "Postule depuis l'alerte",
    desc: "Une alerte arrive quand une bourse correspond à ton profil, et tu postules depuis la plateforme.",
  },
]

const AVANTAGES = [
  {
    icon: Target,
    title: "Uniquement le pertinent",
    desc: "Chaque bourse est rapprochée de ta filière, de ta ville et de tes centres d'intérêt. Aucun bruit, aucune perte de temps.",
  },
  {
    icon: Bell,
    title: "Alerte quand ça correspond",
    desc: "Une alerte part dès qu'une nouvelle bourse correspond à ton profil — pas de veille à faire à la main.",
  },
  {
    icon: Shield,
    title: "Données protégées",
    desc: "Ton profil reste privé, opt-in clair et désinscription en un clic depuis tes paramètres.",
  },
  {
    icon: Clock,
    title: "Inscription sans friction",
    desc: "Pas d'application à installer, pas de parcours à rallonge : un formulaire court et c'est parti.",
  },
  {
    icon: Users,
    title: "100 % gratuit",
    desc: "Un service pensé pour les étudiants mauritaniens, sans frais cachés ni abonnement.",
  },
  {
    icon: Sparkles,
    title: "Sources affichées",
    desc: "Chaque offre indique d'où elle provient et renvoie vers la page d'origine : tu peux vérifier avant de postuler.",
  },
]

// Badges d'icônes monochromes : zéro rainbow, la couleur signature reste rare.
// La « Bourse » en vedette en tête de liste.
const TYPES_OFFRES = [
  { icon: Award, label: "Bourse d'études", desc: "Masters, PhD et séjours financés" },
  { icon: GraduationCap, label: "Stage PFE", desc: "Fin d'études, 3-6 mois" },
  { icon: Clock, label: "Stage Été", desc: "2-3 mois pendant les vacances" },
]

// Sources d'offres réellement observées dans GET /api/v1/offres (source_name) :
// liste tenue à jour à la main, aucune prétention de « partenariat ».
const SOURCES = [
  "Beta.mr", "Scholar Africa", "AfterSchool Africa", "Opportunities for Youth",
  "Opportunity Desk", "LinkedIn", "Mauritel", "SNIM",
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header global blanc — chrome Jobteaser unifié */}
      <Header />
      {/* Hero — bloc near-black = ancrage premium, accent uniquement sur le CTA */}
      <section className="relative overflow-hidden fond-nuit-anime text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
        />
        {/* Lueur radiale douce qui respire — profondeur élégante (zéro noir) */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="lueur-nuit absolute -top-32 left-1/4 h-[560px] w-[560px] rounded-full blur-3xl" />
        </div>
        <div className="container relative mx-auto px-4 py-24 lg:py-32">
          {/* Conteneur du hero : mesure desktop (verify-design) via data-probe */}
          <div data-probe="hero-conteneur" className="mx-auto max-w-3xl text-center lg:max-w-6xl">
            <div className="entree-douce mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-surlignage" />
              <span>Bourses et stages au même endroit</span>
            </div>

            <h1 className="entree-douce mb-6 font-display text-[clamp(2.5rem,6vw,4rem)] font-bold leading-[1.06] tracking-[-0.03em] lg:text-[clamp(4rem,6vw,5.5rem)]">
              Ta bourse d&apos;études, <br />
              <span className="box-decoration-clone rounded bg-surlignage px-2 pb-1 text-ink">
                sans le stress
              </span>
            </h1>

            <p className="entree-douce mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-white/70 lg:max-w-3xl">
              LAWOL.mr t&apos;envoie uniquement les bourses d&apos;études et offres de stage
              qui correspondent à{" "}
              <strong className="font-semibold text-white">ton profil</strong> — sur une seule
              plateforme. Fini la veille quotidienne, les sites éparpillés et les opportunités
              ratées.
            </p>

            {/* Recherche — pattern Jobteaser : champ proéminent dans le hero */}
            <HeroSearch />

            <div className="mb-4 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/inscription" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="h-12 w-full rounded-lg bg-signature px-6 text-base text-white hover:bg-signature-deep sm:w-auto"
                  asChild
                >
                  <span className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5" />
                    Créer mon profil gratuitement
                    <ArrowRight className="h-5 w-5" />
                  </span>
                </Button>
              </Link>
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
              {/* Chiffres réels (relevés à la volée) — rendus null si le relevé échoue */}
              <Compteurs />
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                <CheckCircle className="h-4 w-4 text-white/60" />
                <span>100% gratuit pour les étudiants</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                <Shield className="h-4 w-4 text-white/60" />
                <span>Profil privé, désinscription en un clic</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                <Clock className="h-4 w-4 text-white/60" />
                <span>Inscription simple, sans application</span>
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
              De l&apos;inscription à la première opportunité, tout se passe sur LAWOL.mr.
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
              Veille d&apos;opportunités automatique
            </p>
            <h2 className="mb-4 font-display text-3xl font-bold tracking-[-0.02em] text-ink lg:text-4xl">
              Pourquoi <span className="text-signature">LAWOL.mr</span> ?
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Une veille de bourses et d&apos;offres qui travaille à ta place.
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
              Bourses en tête, 100 % bourses
            </p>
            <h2 className="mb-4 font-display text-3xl font-bold tracking-[-0.02em] text-ink lg:text-4xl">
              Que des bourses, pour <span className="text-signature">ton profil</span>
            </h2>
          </div>

          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 md:grid-cols-3 lg:max-w-6xl lg:grid-cols-3">
            {TYPES_OFFRES.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-border bg-card p-6 transition-colors duration-200 hover:border-signature"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-nuit text-white">
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
              D&apos;où viennent les offres
            </p>
            <h2 className="mb-4 font-display text-3xl font-bold tracking-[-0.02em] text-ink lg:text-4xl">
              Des canaux <span className="text-signature">identifiés, pas déclarés</span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Les sources observées sur les offres publiées — chacune reste affichée sur
              la fiche, avec lien vers la page d&apos;origine.
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

      {/* Qui publie les offres — logos codés en dur remplacés par un classement réel
          (composant client ; section entière rendue null si le relevé échoue) */}
      <Organisations />

      {/* Bannières CTA — recruteurs / universités (pattern Jobteaser) */}
      <section className="border-y border-border bg-card py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-2xl gap-6 md:grid-cols-1">
            <div className="rounded-lg border border-border bg-background p-8 text-center">
              <h3 className="mb-2 font-display text-2xl font-bold tracking-[-0.02em] text-ink">
                Votre université ?
              </h3>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Offrez à vos étudiants un accès privilégié aux bourses et offres qui correspondent
                à leur filière, directement depuis leur profil LAWOL.mr.
              </p>
              <Link href="/contact">
                <Button
                  variant="outline"
                  className="h-11 rounded-lg border-border px-6 transition-colors duration-150 hover:border-signature hover:text-signature"
                >
                  Devenir partenaire
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final — bloc near-black, accent uniquement sur le bouton */}
      <section className="bg-background py-24 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl rounded-lg fond-nuit px-8 py-12 text-center lg:max-w-5xl lg:px-14 lg:py-16">
            <h2 className="mb-4 font-display text-3xl font-bold tracking-[-0.02em] text-white lg:text-4xl">
              Prêt à ne plus rater aucune bourse ?
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-lg text-white/70">
              Rejoins la plateforme pensée pour les étudiants mauritaniens et reçois tes bourses
              matchées avec ton profil.
            </p>
            <Link href="/inscription" className="inline-block w-full sm:w-auto">
              <Button
                size="lg"
                className="h-12 w-full rounded-lg bg-signature px-6 text-base text-white hover:bg-signature-deep sm:w-auto"
                asChild
              >
                <span className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Commencer gratuitement
                  <ArrowRight className="h-5 w-5" />
                </span>
              </Button>
            </Link>
            <p className="mt-5 text-sm text-white/60">
              Gratuit, sans engagement, désinscription en un clic.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  )
}
