# Modèle économique — LAWOL

> À compléter et valider ensemble. Ce document explore les options de durabilité financière.

## 1. Contraintes et principes

- **Accès gratuit pour l'étudiant** : la cible (étudiants mauritaniens) a un pouvoir d'achat limité. Un modèle payant direct limiterait drastiquement l'adoption.
- **Ne pas facturer l'accès à l'information** : l'information sur les bourses devrait rester accessible.
- **Durabilité avant tout** : le modèle doit couvrir les coûts d'infrastructure (Vercel, Railway, Supabase, SMS/WhatsApp si activé) et permettre une évolution.

## 2. Options de revenus (à évaluer)

| Option | Description | Avantage | Inconvénient | Pertinence LAWOL |
|--------|-------------|----------|--------------|------------------|
| **Sponsoring institutions** | Universités étrangères, ambassades, fondations paient pour mettre en avant leurs bourses | Revenu récurrent, aligné avec la mission | Risque de partialité (offres sponsorisées en tête) | Élevée |
| **Freemium établissements** | Accès gratuit pour étudiants ; version payante pour établissements (tableau de bord, analytics) | Revenu B2B stable | Cycle de vente long | Moyenne |
| **Frais de mise en relation** | Commission si un étudiant obtient une bourse via LAWOL | Aligné sur le succès | Complexe à tracker, éthique délicate | Faible |
| **Donations / mécénat** | Soutien d'organisations éducatives | Non dilutif | Imprévisible | Faible |
| **Partenariats agencies** | Agences de placement / visa paient pour l'accès aux étudiants qualifiés | Revenu B2B | Conflit d'intérêts potentiel | Moyenne |

## 3. Coûts identifiés (infrastructure)

| Poste | Outil | Coût estimé (mensuel) | Statut |
|-------|-------|----------------------|--------|
| Hébergement front | Vercel | Gratuit (Hobby) ou ~20 $ (Pro) | Actif |
| Hébergement API | Railway | ~5-20 $ | Actif |
| Base de données + storage | Supabase | Gratuit (tier gratuit) ou ~25 $ | Actif |
| Notifications WhatsApp | Meta WhatsApp Business API | À définir (en attente de vérification) | Bloqué |
| Notifications email | SMTP / Brevo / SendGrid | ~0-20 $ selon volume | À configurer |
| Nom de domaine | lawol.mr | ~10-15 $/an | Non actif (DNS NXDOMAIN) |

**Total estimé** : ~30-80 $/mois selon le tier choisi.

## 4. Scénarios de durabilité

### Scénario A — Gratuit + sponsoring (recommandé à court terme)
- LAWOL reste gratuit pour les étudiants
- Revenus : sponsoring institutions (ambassades, fondations, universités)
- Seuil de rentabilité : 3-5 sponsors à 100-300 $/mois

### Scénario B — Freemium établissements (moyen terme)
- Gratuit étudiants ; payant établissements (tableau de bord + analytics)
- Seuil de rentabilité : 5-10 établissements à 50-100 $/mois

### Scénario C — Hybride (long terme)
- Mix sponsoring + freemium établissements + partenariats agencies

## 5. Questions ouvertes pour discussion

1. Quel modèle économique te semble le plus adapté au contexte mauritanien ?
2. Accepterais-tu des sponsors (universités étrangères, fondations) qui paient pour de la visibilité sur LAWOL ?
3. Quels coûts actuels souhaites-tu couvrir en priorité ?
4. À quel moment envisages-tu de passer du prototype à un modèle générant du revenu ?
