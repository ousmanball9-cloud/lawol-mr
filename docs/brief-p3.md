# Brief P3 — Matching amélioré

## Contexte
Le matching actuel (engine.py) utilise une règle binaire (match pas de match) avec score hardcodé à 100. Pas de tri par pertinence, pas de limite anti-spam, pas de déduplication.

## Objectif
Améliorer le matching pour être plus pertinent et anti-spam.

## Spécifications

### 1. Score de pertinence (0-100)
- **Filière exacte** (profil.filiere ∈ offre.filieres_cibles) : +50
- **Filière d'intérêt** (profil.filieres_interet ∩ offre.filieres_cibles) : +30
- **Ville exacte** : +20
- **Ville AUTRE** (joker) : +10
- **Fraîcheur** (offre scrapée il y a < 7 jours) : +10
- **Deadline proche** (< 14 jours) : +10
- Score max = 100, min = 0

### 2. Limite anti-spam
- Maximum **5 matches par étudiant par semaine**
- Si plus de 5 matches, garder les 5 meilleurs scores
- Configurable via constante `MAX_MATCHES_PAR_SEMAINE = 5`

### 3. Déduplication
- Hash de l'offre : `hashlib.md5((titre + entreprise + date_limite).encode()).hexdigest()`
- Si 2 offres ont le même hash, garder la plus récente
- Stocker le hash dans `offres.metadata['content_hash']`

### 4. Tri par pertinence
- Les matches sont triés par score décroissant
- Les matches avec score < 30 sont ignorés (pas pertinents)

## Références
- `apps/api/app/modules/matching/engine.py` — moteur de matching
- `apps/api/app/modules/shared/models.py` — modèles
- `infra/supabase/schema.sql` — schéma (table matches, offres)

## Critères de réussite
- Score calculé correctement (testé avec cas limites)
- Limite anti-spam respectée
- Déduplication fonctionnelle
- Pas de régression (matching existant toujours fonctionnel)

## Limites
- Ne pas toucher à WhatsApp (webhook, sender, notifier)
- Ne pas toucher au scraper
- Ne pas toucher au dashboard admin
- Ne pas toucher à l'inscription web (P2)
