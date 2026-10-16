import Link from "next/link";
import { Chrome } from "@/components/chrome/chrome";
import { CtaWhatsApp } from "@/components/contact/cta-whatsapp";

export default function ContactPage() {
  return (
    <Chrome>
    <div className="py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Contact</h1>
        <p className="text-gray-600 mb-4">Dernière mise à jour : octobre 2026</p>

        <h2 className="text-xl font-semibold mt-8 mb-3">1. Nous écrire</h2>
        {/* CTA WhatsApp : numéro lu dans le réglage public `support_whatsapp`
            (table parametres), avec repli `lib/contact.ts` — jamais de numéro
            inventé. Lecture côté client : le rendu statique reste intact. */}
        <CtaWhatsApp />

        <h2 className="text-xl font-semibold mt-8 mb-3">2. Espace gérant</h2>
        <p className="text-gray-600 mb-4">
          Les gérants et l&apos;équipe LAWOL accèdent à leur tableau de bord (bourses, profils,
          statistiques) via l&apos;espace réservé — cette adresse n&apos;est pas destinée aux
          étudiants.
        </p>
        <p className="text-gray-600">
          <Link
            href="/admin-login"
            className="text-signature underline underline-offset-4 hover:text-signature-deep"
          >
            Aller à l&apos;espace gérant
          </Link>
        </p>
      </div>
    </div>
    </Chrome>
  );
}
