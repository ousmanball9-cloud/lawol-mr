import { Chrome } from "@/components/chrome/chrome";

export default function ConditionsPage() {
  return (
    <Chrome>
    <div className="py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Conditions d&apos;utilisation</h1>
        <p className="text-gray-600 mb-4">Dernière mise à jour : octobre 2026</p>

        <h2 className="text-xl font-semibold mt-8 mb-3">1. Service</h2>
        <p className="text-gray-600 mb-4">
          LAWOL.mr est une plateforme de mise en relation qui présente aux étudiants mauritaniens
          les bourses d&apos;études, stages/PFE, emplois juniors et alternances correspondant à
          leur profil. Le service est gratuit.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">2. Inscription</h2>
        <p className="text-gray-600 mb-4">
          L&apos;inscription se fait en ligne sur LAWOL.mr via un formulaire court. L&apos;étudiant
          crée son profil (filière, niveau, ville, types d&apos;opportunités recherchés) et accepte
          de recevoir des alertes correspondant à son profil.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">3. Désinscription</h2>
        <p className="text-gray-600 mb-4">
          L&apos;étudiant peut se désinscrire à tout moment depuis son espace personnel
          (Paramètres → Désinscription). Son profil est alors désactivé.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">4. Responsabilité</h2>
        <p className="text-gray-600 mb-4">
          LAWOL.mr ne garantit pas l&apos;exactitude des offres publiées. La candidature et la
          sélection restent de la responsabilité de l&apos;étudiant et de l&apos;entreprise.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">5. Contact</h2>
        <p className="text-gray-600">
          Pour toute question : lawol@lawol.mr
        </p>
      </div>
    </div>
    </Chrome>
  );
}
