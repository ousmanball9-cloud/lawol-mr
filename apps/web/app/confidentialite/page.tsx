export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-white py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Politique de confidentialité</h1>
        <p className="text-gray-600 mb-4">Dernière mise à jour : octobre 2026</p>

        <h2 className="text-xl font-semibold mt-8 mb-3">1. Données collectées</h2>
        <p className="text-gray-600 mb-4">
          LAWOL.mr collecte uniquement les données nécessaires au matching : nom, téléphone,
          université, filière, niveau et ville. Aucune donnée n&apos;est vendue à des tiers.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">2. Utilisation</h2>
        <p className="text-gray-600 mb-4">
          Vos données sont utilisées uniquement pour vous envoyer les offres de stage/PFE
          correspondant à votre profil, via WhatsApp.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">3. Suppression</h2>
        <p className="text-gray-600 mb-4">
          Vous pouvez demander la suppression de vos données à tout moment en nous contactant.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">4. Contact</h2>
        <p className="text-gray-600">
          Pour toute question : lawol@lawol.mr
        </p>
      </div>
    </div>
  );
}
