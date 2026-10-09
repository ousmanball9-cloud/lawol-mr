const WHATSAPP_URL =
  "https://wa.me/222XXXXXXXX?text=Bonjour%20LAWOL%2C%20je%20veux%20recevoir%20les%20offres%20qui%20matchent%20mon%20profil.";

export default function MentionsPage() {
  return (
    <div className="min-h-screen bg-white py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Mentions légales</h1>
        <p className="text-gray-600 mb-4">Dernière mise à jour : octobre 2026</p>

        <h2 className="text-xl font-semibold mt-8 mb-3">1. Éditeur</h2>
        <p className="text-gray-600 mb-4">
          LAWOL.mr est une plateforme qui connecte les étudiants mauritaniens aux offres de
          stage, PFE, emploi junior et alternance qui correspondent à leur profil. Le site est
          édité par l&apos;équipe LAWOL.mr, basée en Mauritanie.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">2. Contact</h2>
        <p className="text-gray-600 mb-4">
          Pour toute question, contactez-nous directement sur WhatsApp :{" "}
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener"
            className="text-signature underline underline-offset-4 hover:text-signature-deep"
          >
            écrire à LAWOL.mr sur WhatsApp
          </a>
          .
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">3. Hébergement</h2>
        <p className="text-gray-600 mb-4">
          Le site est hébergé par Vercel Inc. Les données des profils sont stockées sur une
          API dédiée (backend LAWOL.mr).
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">4. Loi applicable</h2>
        <p className="text-gray-600">
          Les présentes mentions légales sont régies par la législation mauritanienne. En cas
          de litige, les parties chercheront une résolution amiable avant toute action
          judiciaire.
        </p>
      </div>
    </div>
  );
}
