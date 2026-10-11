import { Chrome } from "@/components/chrome/chrome";

export default function MentionsPage() {
  return (
    <Chrome>
    <div className="py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Mentions légales</h1>
        <p className="text-gray-600 mb-4">Dernière mise à jour : octobre 2026</p>

        <h2 className="text-xl font-semibold mt-8 mb-3">1. Éditeur</h2>
        <p className="text-gray-600 mb-4">
          LAWOL.mr est une plateforme qui connecte les étudiants mauritaniens aux bourses
          d&apos;études ainsi qu&apos;aux offres de stage, PFE, emploi junior et alternance qui
          correspondent à leur profil. Le site est édité par l&apos;équipe LAWOL.mr, basée en
          Mauritanie.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">2. Contact</h2>
        <p className="text-gray-600 mb-4">
          Pour toute question, contactez-nous par e-mail :{" "}
          <a
            href="mailto:lawol@lawol.mr"
            className="text-signature underline underline-offset-4 hover:text-signature-deep"
          >
            lawol@lawol.mr
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
    </Chrome>
  );
}
