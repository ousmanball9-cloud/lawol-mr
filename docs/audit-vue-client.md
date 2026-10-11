# Audit stratégique — Vue client (côté étudiant) LAWOL.mr

> Date : 11/10/2026 · Auteur : agent `diablo` (gardien des exigences) · Méthode : vérifié dans le code
> Contexte : refonte « 100 % bourses » (esprit Jobteaser). Front Next.js 15 dans `apps/web`.

## Verdict
Aujourd'hui, LAWOL n'est **pas une plateforme de bourses** — c'est un **catalogue de stages/emplois** avec un habillage bourses **annoncé mais pas exécuté**. Et **3 failles détruisent la confiance** dès la première visite.

---

## 1. URGENCES — cassé ou nuisible (avant toute feature)

| # | Problème | Détail vérifié |
|---|----------|----------------|
| **U1** | **Zéro authentification** (CRITIQUE) | `/connexion` fait `GET /profils/{tel}` puis redirige. Ni OTP, ni mdp, ni session, ni middleware. Connaître un numéro = lire/modifier le profil d'autrui. Faille RGPD. |
| **U2** | **Recherche du hero perdue** (CRITIQUE) | `hero-search.tsx` pousse `?recherche=` vers `/offres` mais `offres/page.tsx` ne lit jamais `searchParams`. Requête jetée. |
| **U3** | **WhatsApp mort exposé** (CRITIQUE) | `222XXXXXXXX` en dur dans `page.tsx`, `parametres/page.tsx`, `form-prefs.tsx`, `mentions/page.tsx`. `/conditions` décrit un « bot WhatsApp » inexistant. Canal réel = 401. |
| **U4** | **Identité bancale** (CRITIQUE) | Objectif « 100 % bourses » mais hero = « Ton stage PFE », types 80 % stages/emplois. |
| **U5** | **Stats recruteur publiques** (MAJEUR) | `nb_matches`/`nb_postules` affichés sur la fiche entreprise publique → fuite de traction. |

---

## 2. Ce qui MANQUE (vs « 100 % bourses » et vs concurrents)

### CRITIQUE
1. **Deadlines partout** — une bourse sans date limite visible/triable/urgente n'existe pas. Pas de tri « urgent », pas de badge J-…, pas de calendrier, pas de rappel. Tous les concurrents l'ont.
2. **Suivi de candidature bourses** — embryon (favori/statut/« j'ai postulé ») mais pas de pipeline : à préparer → dossier → soumise → présélection → obtenue/refusée.
3. **Coffre-fort de documents** — CV, relevés, lettres, passeport. Zéro upload, zéro réemploi.
4. **Filtres bourses** — manquent : pays, niveau (Licence/Master/PhD), financement, langue, deadline. Les filtres actuels sont pensés *stages*.

### MAJEUR
5. Notifications in-app + centre d'alertes (l'email existe mais invisible côté client).
6. Fiche bourse riche (éligibilité, montant, pièces, étapes, source vérifiée).
7. Contenu orientation / conseils bourses (SEO + rétention).
8. Preuves réelles (chiffres, logos) au lieu de slogans statiques.
9. Mobile + navigation (pas de burger, header à 2 liens, pas de chrome sur le profil).

### MINEUR (dette, pas priorité produit)
- Page `/inscription/confirmation` orpheline · duplication `FILIERES/VILLES/TYPES` (4 fichiers) · duplication `FormPrefs` ↔ `/parametres` · pages légales minimales (hors `/conditions` qui est faux = majeur).

---

## 3. Garde des exigences — SCOPE CREEP à REFUSER ce trimestre
Événements/salons · assistant IA · multi-langue FR/AR · espace universités/partenaires · parrainage (placeholder) · annuaire entreprises exhaustif (pour des bourses, les pertinents = **bailleurs/gouvernements/fondations**).

> **Règle de focus** : tout ce qui n'aide pas un étudiant à trouver une bourse avant sa deadline, constituer son dossier et suivre sa candidature = **refusé**.

---

## 4. Recommandation — 7 actions ordonnées (catalogue → plateforme)

| # | Action | Pourquoi d'abord |
|---|--------|------------------|
| 1 | Fermer l'**auth** (OTP/PIN) + **purger les mentions WhatsApp/bot** | Sans confiance et sans canal honnête, tout le reste est décor sur une faille. |
| 2 | Bascule **wording 100 % bourses** (hero, /offres, types, /conditions, connexion) + brancher `?recherche=` |1 jour, effet immédiat. |
| 3 | **Deadlines partout** : champ obligatoire, badge J-…, tri « urgent », filtre < 30j, masquer expirées | LE différenciateur bourses vs stages. |
| 4 | **Fiche bourse standard** : éligibilité / financement / pièces / étapes / source + CTA « suivre ma candidature » | Fiche = dossier de décision. |
| 5 | **Pipeline candidature + coffre-fort documents v1** | Ce qui fait revenir. |
| 6 | **Centre notifications in-app** + page conseils bourses v1 (5 guides) | Rétention + SEO. |
| 7 | **Preuves réelles + mobile** : vrais compteurs, logos retirés/autorisés, burger, chrome global | Crédibilité. |

### À SUPPRIMER immédiatement (sans remplacement)
CTA `222XXXXXXXX` · page confirmation orpheline (ou la brancher) · parrainage placeholder · `nb_matches/nb_postules` publics · SDK Facebook fantôme · allégation « centaines d'étudiants » tant que non mesurée.

---

## Critère de sortie
Un étudiant peut, **sur mobile**, chercher une bourse Master, voir sa deadline, déposer son dossier depuis son coffre-fort, suivre son statut et recevoir un rappel — **sans jamais voir « stage PFE » ni un numéro vide**. Tant que ce parcours n'existe pas, ne pas parler de « plateforme ».
