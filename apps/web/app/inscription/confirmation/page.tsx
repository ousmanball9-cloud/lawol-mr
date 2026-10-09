import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight } from "lucide-react";

export default function ConfirmationPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-xl shadow-primary/5 sm:p-10">
        <div className="mx-auto mb-6 flex h-20 w-20 animate-in items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-800 text-white shadow-lg shadow-emerald-700/30 duration-500 fade-in zoom-in-95">
          <CheckCircle className="h-10 w-10" />
        </div>

        <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          Profil enregistré
        </span>

        <h1 className="mb-3 text-2xl font-bold text-foreground">Inscription réussie !</h1>
        <p className="mb-8 leading-relaxed text-muted-foreground">
          Tu recevras bientôt les offres correspondant à ton profil sur WhatsApp.
        </p>

        <Link href="/">
          <Button
            size="lg"
            className="w-full rounded-xl shadow-lg shadow-primary/20 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30"
          >
            <span className="flex items-center gap-2">
              Retour à l&apos;accueil
              <ArrowRight className="h-4 w-4" />
            </span>
          </Button>
        </Link>

        <p className="mt-5 text-xs text-muted-foreground">
          Un message de confirmation t&apos;attend sur ton numéro enregistré.
        </p>
      </div>
    </div>
  );
}
