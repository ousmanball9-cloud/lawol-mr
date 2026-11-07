# Calendrier projet LAWOL — 06/11/2026 au 07/12/2026

> Produit par l'agent `planificateur` (subagent terminé). Sources : plan-lots-vague4, registre-risques, PRD, AGENTS.md.

## 1. Lots, durées, dépendances (17 lots, ~32 h 30)

| Lot | Contenu | Durée | Dépend de | Preuve |
|-----|---------|-------|-----------|--------|
| V4-B | Extraction montant (`metadata.montant`) | 2 h 30 (→B1/B2) | V4-A ✅ | compteur « X/281 extraits avec certitude » |
| V4-C | Affichage montant carte+fiche, silence si absent | 1 h 30 | V4-B | harnais live + contrôle négatif |
| V4-D | Éligibilité par origine (indice « compatible ») | 2 h 30 (→D1/D2) | V4-A ✅ | taux de couverture + fiche sourcée |
| **V4-G ★** | **Prérequis donnée** : faire produire `calendrier`/`dates_par_pays` (MESRS = **0 ligne** sur 505) | 2 h | aucune | taux couverture `couverture-metadata.py` |
| V4-E | V3-09 calendrier de sélection (ou verdict « non faisable, preuve ») | 2 h | V4-D **et** V4-G | ≥ 2 étapes datées OU preuve d'absence |
| V4-F | V3-10 dates par pays (affichage conditionnel) | 1 h 30 | V4-E | harnais non-régression échéance |
| V5-A | Filtres `financement`+`cloture30` serveur (fin du bassin 500) | 2 h 30 | aucune | mesure avant/après |
| V5-B | TTFB froid : instrumenter, isoler Vercel vs API | 1 h 30 | aucune | chiffres, aucune promesse |
| V5-C ×4 | 8 sources gouvernementales **par paires** | 2 h/paire | aucune | run réel + `verify-sante-collecte` |
| V5-D | Rejouer `POST /matching/run` en prod (jamais fait depuis barème v3) | 1 h | aucune | distribution + écart max |
| V5-E | `SCRAPER_TOKEN` dédié révocable + **rotation clés Supabase** (en attente user depuis 11/10) | 2 h | aucune | preuve 401/403 |
| **CANAL-E ★** | **SMTP réel + 1re notification email envoyée** (Lot E : codé, mocké 30/30, jamais envoyé) | 2 h | aucune (**porte : credentials SMTP user**) | envoi réel prouvé + harnais |
| **BACKUP ★** | Vérifier/configurer les backups Supabase (risque #6 : base non sauvegardée) | 1 h | aucune | statut backup daté |
| **SEC-REVIEW ★** | Revue sécurité avant ouverture (risque #10, registre) | 2 h | tous lots code + V5-E | rapport sév:fichier:ligne + correctifs |

## 2. Chemin critique & marges

| Chaîne | Jalon daté | Chemin critique | Marges |
|--------|------------|-----------------|---------|
| **V4 (ingestion)** | **M1 = ven 13/11** | V4-A ✅ → **V4-D → V4-E → V4-F** (D est le point de liaison : G finit avant) | V4-B/C : 2 j · V4-G : 1 j · **V4-D : marge 0** |
| **V5 (dettes)** | **M2 = mer 25/11** | V5-C paires 1→4 (dernière paire = liaison) | V5-A/B/D : 4-7 j · fin V5-C : **1 j** (mer 25 = session buffer) |
| **Sécurité → ouverture** | **G1 = lun 30/11** | V5-C → SEC-REVIEW (jeu 26) → M3 (ven 27) | SEC-REVIEW : 1 j · BACKUP : 5 j · V5-E : 8 j |
| **Canal (PRD)** | G1 + M-A2 | CANAL-E dépend **uniquement du user** | **0 si credentials absents** |

**Alertes marge zéro** : V4-D (hors critique = retard final immédiat sur M1) ; fin V5-C et SEC-REVIEW (1 jour chacune) ; CANAL-E (dépendance externe, pas de marge réelle).

## 3. Calendrier daté

### S2 — 09 → 13/11 : cœur critique V4
| Date | Lot(s) | Fin de journée |
|------|--------|----------------|
| Lun 09/11 | V4-B (2 h 30) | extracteur montant + taux réel |
| Mar 10/11 | V4-C (1 h 30) + **V4-G ★** (2 h) | affichage montant prouvé + couverture donnée mesurée |
| Mer 11/11 | V4-D (2 h 30) — **critique** | éligibilité sourcée |
| Jeu 12/11 | V4-E (2 h) — **critique** | V3-09 livré ou « non faisable » prouvé |
| Ven 13/11 | V4-F (1 h 30) + V5-D (1 h) | **→ M1 : VAGUE 4 CLOSE** |

### S3 — 16 → 20/11 : dettes V5 + canal + sécurité
| Date | Lot(s) |
|------|--------|
| Lun 16/11 | V5-A (2 h 30) |
| Mar 17/11 | V5-E (2 h) + V5-B (1 h 30) |
| Mer 18/11 | **CANAL-E ★ (2 h)** — *credentials SMTP impérativement posés avant* |
| Jeu 19/11 | **BACKUP ★ (1 h)** + V5-C paire 1 (2 h) |
| Ven 20/11 | V5-C paire 2 (2 h) |

### S4 — 23 → 27/11 : fin V5 + audit
| Date | Lot(s) | Jalon |
|------|--------|-------|
| Lun 23/11 | V5-C paire 3 | — |
| Mar 24/11 | V5-C paire 4 | fin V5-C |
| Mer 25/11 | **buffer/rattrapage (marge chaîne V5-C)** | **M2 : DÉTTES V5 CLOSE** |
| Jeu 26/11 | **SEC-REVIEW ★ (2 h)** | — |
| Ven 27/11 | Audit de clôture : battery harnais live complète + maj `registre-risques.md` + `problems-found-produit.md` | **M3 : CLÔTURE D'AUDIT** |

### S5 — 30/11 → 07/12 : stratégie PRD
| Date | Étape | Réf. PRD |
|------|-------|----------|
| Lun 30/11 | **G1 — ouverture accompagnée** : acquisition de **20 vrais étudiants** (action utilisateur) | §9.1 |
| Mar 01/12 | **1re notification réelle délivrée** (email) — le produit tient enfin sa promesse centrale (0 % → 1) | §9.2, §3 |
| Ven 04/12 | Point de mesure : taux de lecture/réponse | §9.3 |
| Lun 07/12 | **M4 : go/no-go > 30 % de réponse** + baseline **North Star** (candidatures déclarées/semaine) | §9.4, §6 |

## 4. Portes communes à CHAQUE lot (AGENTS.md)

1. Session = lot nommé ≤ 2 h (couper **avant** épuisement) = 1 branche = 1 commit + 1 harnais + note de reprise 5 lignes.
2. KPI : `mesure-tokens.ps1 -Snap` avant / `-Diff` après → `kpi-suivi.md` ; > 100 k sans part déléguée → post-mortem.
3. Gates avant commit : `py_compile`+`ruff` (API), `tsc --noEmit`+`eslint` (web), `vitest`, `scripts/test-*.py` — **jamais de build** en tâche courante.
4. Déploiement → **preuve live** (`verify-live-public` + `verify-fiche-bourse`) ; **contrôle négatif joué avant** déploiement.
5. Tout endpoint `/api/v1/*` → proxy Next local qui **relaie `Authorization`** ; admin = relais `Cookie` + `x-admin-token` + `Authorization`.
6. **Zéro migration SQL** → clés dans `offres.metadata`/`profils.metadata` conformes au contrat 9 clés ; écriture enum bridée, lecture union SQL ; « 100 % bourses » au point d'écriture `BaseScraper.save`.
7. Identité : **jamais** présenter `lawol.mr` comme URL fonctionnelle ; secrets jamais commités ; push de workflow = commit scindé.

## 5. Ce qui peut faire glisser le calendrier

- **Credentials SMTP** (en attente depuis le 10/11) : sans eux, CANAL-E → M-A2 → tout le bloc S5 glisse — **les demander maintenant**.
- **Rotation clés Supabase** (en attente user depuis le 11/10) : à faire dans V5-E, action utilisateur.
- **V4-G** : si la couverture reste à 0, V4-E/V4-F livrent le verdict « non faisable, preuve » — M1 (13/11) reste atteint, mais V3-09/V3-10 non livrés.
- WhatsApp Meta (budget) = décision hors planning.
