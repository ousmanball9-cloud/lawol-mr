import Link from "next/link"
import { Button } from "@/components/ui/button"
import { 
  MessageSquare, CheckCircle, Clock, Shield, 
  GraduationCap, Briefcase, Zap, ArrowRight 
} from "lucide-react"

const WHATSAPP_URL = "https://wa.me/222XXXXXXXX?text=Bonjour%20LAWOL%2C%20je%20veux%20recevoir%20les%20offres%20qui%20matchent%20mon%20profil."

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background py-20 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Zap className="h-4 w-4" />
              <span>Nouveau : Offres PFE directement sur WhatsApp</span>
            </div>
            
            <h1 className="text-4xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
              Ton stage PFE, <br />
              <span className="text-primary">sans le stress</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              LAWOL.mr t&apos;envoie uniquement les offres de stage, emploi junior et alternance 
              qui correspondent à <strong>ton profil</strong> — directement sur WhatsApp. 
              Fini la veille quotidienne, les groupes saturés et les offres ratées.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="w-full sm:w-auto" asChild>
                  <span className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Recevoir les offres sur WhatsApp
                    <ArrowRight className="h-5 w-5" />
                  </span>
                </Button>
              </a>
              <Link href="#comment-ca-marche">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Comment ça marche
                </Button>
              </Link>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                <span>100% gratuit pour les étudiants</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <span>Données protégées (RGPD)</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <span>Inscription en 30 secondes</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section id="comment-ca-marche" className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Comment ça marche en <span className="text-primary">3 étapes</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Simple, rapide, sans application à installer.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                icon: GraduationCap,
                title: "1. Crée ton profil",
                desc: "Remplis un court formulaire : filière, niveau, ville, type d'offre recherché. 2 minutes chrono."
              },
              {
                icon: Zap,
                title: "2. On trouve pour toi",
                desc: "Nos robots scannent LinkedIn, sites entreprises, ANPE, universités. Le matching est automatique et instantané."
              },
              {
                icon: MessageSquare,
                title: "3. Reçois sur WhatsApp",
                desc: "Seules les offres qui matchent ton profil arrivent sur ton WhatsApp. Tu postules en un clic."
              }
            ].map((step, i) => (
              <div key={i} className="text-center p-6 rounded-xl bg-card border shadow-sm hover:shadow-md transition-shadow">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
                  <step.icon className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Types d'offres */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Tous types d&apos;opportunités pour <span className="text-primary">ton profil</span>
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { icon: GraduationCap, label: "Stage PFE", desc: "Fin d'études, 3-6 mois", color: "bg-blue-500" },
              { icon: Briefcase, label: "Emploi Junior", desc: "Premier job, 0-2 ans exp.", color: "bg-emerald-500" },
              { icon: Zap, label: "Alternance", desc: "Études + travail en entreprise", color: "bg-amber-500" },
              { icon: Clock, label: "Stage Été", desc: "2-3 mois pendant les vacances", color: "bg-violet-500" },
            ].map((item, i) => (
              <div key={i} className="p-6 rounded-xl bg-card border shadow-sm">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg ${item.color} text-white mb-4`}>
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-lg mb-1">{item.label}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sources */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Nos sources <span className="text-primary">fiables & officielles</span>
            </h2>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              "Mauritel", "Chinguitty Bank", "BNM", "SNIM",
              "TotalEnergies", "Ooredoo", "MCM", "BACIM",
              "ANPE", "LinkedIn", "Universités", "Ambassades"
            ].map((src, i) => (
              <div key={i} className="p-4 rounded-lg bg-card border text-center text-sm font-medium">
                {src}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-6">
              Prêt à ne plus rater aucune offre ?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Rejoins des centaines d&apos;étudiants mauritaniens qui reçoivent déjà leurs offres matchées sur WhatsApp.
            </p>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="w-full sm:w-auto" asChild>
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Commencer gratuitement sur WhatsApp
                  <ArrowRight className="h-5 w-5" />
                </span>
              </Button>
            </a>
            <p className="mt-4 text-sm text-muted-foreground">
              En cliquant, tu ouvres WhatsApp avec un message pré-rempli. Aucune donnée n&apos;est collectée avant ton accord.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold mb-4">LAWOL.mr</h3>
              <p className="text-sm text-muted-foreground">
                La plateforme qui connecte les étudiants mauritaniens 
                aux opportunités qui leur correspondent.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-4">Liens</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/mentions" className="hover:text-foreground">Mentions légales</Link></li>
                <li><Link href="/confidentialite" className="hover:text-foreground">Confidentialité</Link></li>
                <li><Link href="/contact" className="hover:text-foreground">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4">Pour les étudiants</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Recevoir les offres</li>
                <li>Modifier mon profil</li>
                <li>Se désinscrire</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4">Pour les entreprises</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Publier une offre</li>
                <li>Espace recruteur</li>
                <li>Partenariat</li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-sm text-muted-foreground">
            <p>© 2024 LAWOL.mr — Tous droits réservés.</p>
            <p className="mt-1">Fait avec ❤️ pour les étudiants mauritaniens.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}