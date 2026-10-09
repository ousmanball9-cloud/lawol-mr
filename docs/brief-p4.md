# Brief P4 — Rétention & passage à l'acte (features vérifiées)

Source : critique Diablo du 2026-10-09, chaque point vérifié contre le code.

## À implémenter (après P0-P3, avant design)

### 1. Lien source sur chaque carte offre (North Star)
- `source_url` existe déjà dans `offres` (remplie par les scrapers) — PAS de migration.
- Exposer `source_url` dans `OffreStagePublic` (models.py) + sélection dans GET /matches.
- Bouton "Voir l'offre originale" (target=_blank, rel=noopener) sur chaque carte profil.
- Effort : XS.

### 2. Page "Retrouver mon profil"
- `/connexion` ou `/profil` : 1 input téléphone → GET /profils/{tel} → redirection.
- Après inscription réussie : sauvegarder le téléphone en `localStorage` + lien "Mon profil" sur la landing si présent.
- Résout le 409 impasse : message 409 → lien "Tu es déjà inscrit ? Retrouve ton profil".
- Effort : S.

### 3. Empty state diagnostic + élargissement 1-clic
- Quand 0 offre : afficher "0 offre car : types=[…], ville=[…]" + bouton "Élargir" 
  (modifie le profil : villes élargies / tous types) puis reload.
- Effort : XS.

### 4. Validation : au moins 1 type recherché
- Client (inscription + edit) : refuser `types_recherches.length === 0`.
- Serveur (POST/PUT profils) : 422 si liste vide.
- Effort : XS.

### 5. Feedback pertinence 👍/👎 par match
- Colonne `matches.feedback text null` (migration SQL : 'up' | 'down' | null).
- 2 boutons par carte → POST /api/v1/matches/{id}/feedback.
- Mesure l'O1 (pertinence > 80%) sans analytics payant.
- Effort : S.

### 6. Parrainage wa.me (acquisition 0 €)
- Bouton "Inviter un ami de ma promo" → `https://wa.me/?text=<texte+lien /inscription>`.
- Effort : XS.

## Limite
- Ne PAS toucher au design (dernière étape, séparée).
- Ne PAS toucher à WhatsApp webhook/sender/notifier.
- Une seule migration SQL regroupée (feedback + rien d'autre).

## Décision stratégique en attente (à valider avec l'utilisateur)
- Abandon Meta Cloud API 6 mois → diffusion manuelle hebdo (copier-coller lien profil 
  + top-3 offres). Web-first : toutes les features ci-dessus ne dépendent pas de Meta.
