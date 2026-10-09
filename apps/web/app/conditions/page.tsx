export default function ConditionsPage() {
  return (
    <div className="min-h-screen bg-white py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Conditions d&apos;utilisation</h1>
        <p className="text-gray-600 mb-4">Dernière mise à jour : octobre 2026</p>

        <h2 className="text-xl font-semibold mt-8 mb-3">1. Service</h2>
        <p className="text-gray-600 mb-4">
          LAWOL.mr envoie aux étudiants mauritaniens les offres de stage/PFE/emploi junior
          correspondant à leur profil, via WhatsApp. Le service est gratuit.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">2. Inscription</h2>
        <p className="text-gray-600 mb-4">
          L&apos;inscription se fait via WhatsApp en envoyant un message au bot. L&apos;étudiant accepte
          de recevoir des offres correspondant à son profil.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">3. Désinscription</h2>
        <p className="text-gray-600 mb-4">
          L&apos;étudiant peut se désinscrire à tout moment en envoyant &quot;STOP&quot; au bot WhatsApp.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">4. Responsabilité</h2>
        <p className="text-gray-600 mb-4">
          LAWOL.mr ne garantit pas l'exactitude des offres publiées. La candidature et la
          sélection restent de la responsabilité de l'étudiant et de l'entreprise.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">5. Contact</h2>
        <p className="text-gray-600">
          Pour toute question : lawol@lawol.mr
        </p>
      </div>
    </div>
  );
}
