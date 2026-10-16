import Link from "next/link";
import { Chrome } from "@/components/chrome/chrome";
import { lienContactWhatsApp } from "@/lib/contact";

export default function ContactPage() {
  // Aucun numéro inventé : le CTA WhatsApp n'est rendu que si
  // `lib/contact.ts` porte un numéro public réel.
  const whatsapp = lienContactWhatsApp();

  return (
    <Chrome>
    <div className="py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Contact</h1>
        <p className="text-gray-600 mb-4">Dernière mise à jour : octobre 2026</p>

        <h2 className="text-xl font-semibold mt-8 mb-3">1. Nous écrire</h2>
        {whatsapp ? (
          <>
            <p className="text-gray-600 mb-4">
              Le canal le plus rapide : WhatsApp. Notre équipe répond aux questions sur
              l&apos;inscription, les bourses reçues et la modification de ton profil.
            </p>
            <p className="mb-6">
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener"
                className="inline-block rounded-lg bg-signature px-5 py-2.5 text-sm font-medium text-white hover:bg-signature-deep"
              >
                Écrire à LAWOL.mr sur WhatsApp
              </a>
            </p>
          </>
        ) : (
          <p className="text-gray-600 mb-4">
            Notre équipe répond aux questions sur l&apos;inscription, les bourses reçues et
            la modification de ton profil. Écris-nous par e-mail :{" "}
            <a
              href="mailto:lawol@lawol.mr"
              className="text-signature underline underline-offset-4 hover:text-signature-deep"
            >
              lawol@lawol.mr
            </a>
            .
          </p>
        )}

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
