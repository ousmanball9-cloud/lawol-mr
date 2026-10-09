import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

export default function ConfirmationPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-6">
          <CheckCircle className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">Inscription réussie !</h1>
        <p className="text-muted-foreground mb-8">
          Tu recevras bientôt les offres correspondant à ton profil sur WhatsApp.
        </p>
        <Link href="/">
          <Button size="lg" className="w-full sm:w-auto">
            Retour à l&apos;accueil
          </Button>
        </Link>
      </div>
    </div>
  );
}
