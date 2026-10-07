# LAWOL.mr — User Stories

## Étudiant

| ID | En tant que... | Je veux... | Afin de... | Priorité |
|---|---|---|---|---|
| US-01 | Étudiant PFE | Inscrire mon profil (filière, niveau, ville) en < 2 min | Recevoir des offres adaptées | 🔴 P0 |
| US-02 | Étudiant PFE | Recevoir uniquement les offres matchées sur WhatsApp | Ne pas perdre de temps avec du bruit | 🔴 P0 |
| US-03 | Étudiant PFE | Mettre à jour mon profil | Garder mes préférences à jour | 🟡 P1 |
| US-04 | Étudiant PFE | Me désinscrire | Ne plus recevoir de messages | 🟡 P1 |

## Entreprise

| ID | En tant que... | Je veux... | Afin de... | Priorité |
|---|---|---|---|---|
| US-10 | Entreprise | Envoyer une offre de stage au bot WhatsApp | Toucher les bons profils | 🔴 P0 |
| US-11 | Entreprise | Voir combien de étudiants ont reçu mon offre | Mesurer l'impact | 🟡 P1 |
| US-12 | Entreprise | Modifier/annuler une offre | Corriger une erreur | 🟡 P1 |

## Admin

| ID | En tant que... | Je veux... | Afin de... | Priorité |
|---|---|---|---|---|
| US-20 | Admin | Voir les stats (offres, profils, matches) | Piloter le produit | 🔴 P0 |
| US-21 | Admin | Ajouter/modifier une offre manuellement | Compléter le scraping | 🟡 P1 |
| US-22 | Admin | Lancer le scraper à la demande | Rafraîchir les offres | 🟡 P1 |
| US-23 | Admin | Exporter les données (CSV) | Analyser le marché | 🟢 P2 |

## Critères d'acceptation (exemple US-02)

- [ ] L'étudiant reçoit un message WhatsApp **uniquement** si un match existe
- [ ] Le message contient : titre, entreprise, ville, date limite, lien
- [ ] Pas de doublon (même offre pas envoyée 2 fois au même étudiant)
- [ ] Délai entre match et envoi < 5 min
