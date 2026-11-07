# Modèle économique — LAWOL

> À compléter et valider ensemble. Ce document explore les options de durabilité financière.

## 1. Contraintes et principes

- **Accès gratuit pour l'étudiant** : la cible (étudiants mauritaniens) a un pouvoir d'achat limité. Un modèle payant direct limiterait drastiquement l'adoption.
- **Ne pas facturer l'accès à l'information** : l'information sur les bourses devrait rester accessible.
- **Durabilité avant tout** : le modèle doit couvrir les coûts d'infrastructure (Vercel, Railway, Supabase, SMS/WhatsApp si activé) et permettre une évolution.

## 2. Modèle économique retenu (défini)

**Accès gratuit aux bourses disponibles** — l'information sur les bourses reste accessible à tous les étudiants mauritaniens.

**Accompagnement de postulation et suivi de candidature payants** — services à valeur ajoutée :
- Aide à la constitution du dossier de candidature
- Relecture et optimisation de la lettre de motivation
- Suivi personnalisé de l'état des candidatures
- Alertes et relances sur les deadlines

## 3. Options complémentaires (à évaluer)

| Option | Description | Pertinence |
|--------|-------------|------------|
| **Sponsoring institutions** | Universités étrangères, ambassades, fondations paient pour de la visibilité | Élevée (aligné avec la mission) |
| **Freemium établissements** | Version payante pour établissements (tableau de bord, analytics) | Moyenne |
| **Partenariats agencies** | Agences de placement / visa paient pour l'accès aux étudiants qualifiés | Moyenne (conflit d'intérêts potentiel) |

## 4. Coûts identifiés (infrastructure)

| Poste | Outil | Coût estimé (mensuel) | Statut |
|-------|-------|----------------------|--------|
| Hébergement front | Vercel | Gratuit (Hobby) ou ~20 $ (Pro) | Actif |
| Hébergement API | Railway | ~5-20 $ | Actif |
| Base de données + storage | Supabase | Gratuit (tier gratuit) ou ~25 $ | Actif |
| Notifications WhatsApp | Meta WhatsApp Business API | À définir (en attente de vérification) | Bloqué |
| Notifications email | SMTP / Brevo / SendGrid | ~0-20 $ selon volume | Opérationnel (P2 fait) |
| Nom de domaine | lawol.mr | ~10-15 $/an | Non actif (DNS NXDOMAIN) |

**Total estimé** : ~30-80 $/mois selon le tier choisi.

## 5. Questions restantes

1. Quel **prix** envisages-tu pour l'accompagnement de postulation et le suivi ?
2. Accepterais-tu des sponsors (universités étrangères, fondations) en complément du modèle payant ?
3. À quel moment envisages-tu de passer du prototype à un modèle générant du revenu ?
