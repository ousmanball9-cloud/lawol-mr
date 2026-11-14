# Calendrier projet LAWOL — 14/11/2026 au 07/12/2026

> **Révision du 14/11/2026** (version précédente : 06/11, caduque).
> Motif de la révision : le jalon **M1 du 13/11 n'a pas été atteint**, et les **12-13/11 ont été consommés par la migration Railway → Render** (sortie d'hébergeur non planifiée).
> Sources : `docs/plan-lots-vague4-2026-11-06.md`, `docs/registre-risques.md`, `docs/prototypage-promesse.md`, `docs/strategie-entrepreneuriale/plan-maitre-lawol.md`, `git log` (main = `1c55991`).

---

## 0. État mesuré au 14/11/2026

| Lot | État | Preuve |
|---|---|---|
| V4-A — contrat `offres.metadata` | FAIT | commit `fad9125`, `couverture-metadata.py` 16 self-tests + contrôle négatif 3/3 |
| V4-B — extraction montant | FAIT | `8dfec01`, `test-montant.py` 39/39, 33 offres affichables (11,5 %) |
| V4-C — affichage montant | FAIT | `verify-montant.mjs` 10/10 |
| V5-A — filtres serveur `financement` + `cloture30` | FAIT (en avance) | `c87fed3` → merge `c1472a9`, vitest 238/238 |
| V4-D — éligibilité par origine | EN COURS (lancé 14/11) | branche `vague4/v4d-origine`, non commitée |
| V4-G / V4-E / V4-F | JAMAIS FAITS | source MESRS = 0 ligne |
| V5-B / V5-C / V5-D / V5-E | JAMAIS FAITS | — |
| BACKUP ★ / SEC-REVIEW ★ / CANAL-E ★ | JAMAIS FAITS | CANAL-E bloqué : credentials SMTP absents depuis le 10/11 |
| P3 / P4 / P5 (prototype) | JAMAIS FAITS | P1, P2 faits ; **0 notification jamais délivrée** |

**Décalage assumé** : 3 lots V4 et 4 lots V5 en retard ; 1 lot (V5-A) en avance. Le retard n'est pas dû au code mais à (a) la sortie d'hébergeur Railway, (b) deux portes externes fermées (SMTP, clés Supabase).

---

## 1. Lots restants (durée, dépendances, preuve attendue)

| Lot | Contenu | Durée | Dépend de | Preuve attendue |
|---|---|---|---|---|
| **V4-D** | Éligibilité par origine — indice « compatible », jamais masquer | 2 h 30 | V4-A ✅ | taux de couverture + fiche affichant l'indice seulement si sourcé |
| **V4-G ★** | Prérequis donnée : produire `calendrier` / `dates_par_pays` | 2 h | — | taux de couverture `couverture-metadata.py` |
| **V4-E** | V3-09 calendrier de sélection (ou verdict « non faisable, preuve ») | 2 h | V4-D + V4-G | ≥ 2 étapes datées OU preuve d'absence |
| **V4-F** | V3-10 dates multiples par pays, affichage conditionnel | 1 h 30 | V4-E | harnais de non-régression échéance |
| **V5-B** | TTFB froid : instrumenter, isoler Vercel vs API | 1 h 30 | — | chiffres, aucune promesse |
| **V5-C ×4** | 8 sources gouvernementales, par paires | 2 h / paire (8 h) | — | run réel + `verify-sante-collecte` |
| **V5-D** | Rejouer `POST /matching/run` en prod | 1 h | — | distribution des scores + écart max |
| **V5-E** | `SCRAPER_TOKEN` dédié + rotation clés Supabase | 2 h | action utilisateur | preuve 401/403 |
| **BACKUP ★** | Vérifier / configurer les backups Supabase | 1 h | — | statut de backup daté — **reprise du brief, non re-vérifiée (token MCP Supabase invalide le 14/11)** |
| **SEC-REVIEW ★** | Revue sécurité avant ouverture | 2 h | V5-E | rapport sévérité / fichier:ligne + correctifs |
| **CANAL-E ★** | SMTP réel + 1re notification email | 2 h | **credentials SMTP** | envoi réel prouvé + harnais |
| **P3** | Opt-in, anti-spam, STOP | 2 h | P2 ✅ | 100 % checks verts + 3 contrôles négatifs |
| **P4** | Run notifications en production | 1 h 30 | P2 ✅ | 401 / 403 / 200 prouvés |
| **P5** | Email manuel + seuil de décision | 1 h 30 | P4 | 3 envois, réponses comptées |

**Charge restante : ~30 h 30** (dont 2 h 30 déjà en cours) sur **10 jours ouvrés** avant G1 → ~2,8 h/jour, soit **2 lots par jour**. Tenable, sans marge de confort.

---

## 2. Chemin critique (CPM) et marges

| Chaîne | Chemin critique | Fin prévue | Marge |
|---|---|---|---|
| **Données V4** | **V4-D → V4-G → V4-E → V4-F** | mer 18/11 | 0 j si V4-D livré le 14/11 ; **−1 j** sinon |
| **Dettes V5** | **V5-C paire 1 → 2 → 3 → 4** (8 h, la plus longue) → M2 | mar 24/11 | 1 j (mer 25/11 = buffer) |
| **Sécurité** | V5-E → **SEC-REVIEW** → M3 | jeu 26/11 | 1 j |
| **Canal (produit)** | **CANAL-E** → P4 → P5 → 1re notification → M4 | dépend du user | **0 j — dépendance externe** |
| Hors critique | V5-B, V5-D, BACKUP, P3 | — | 3 à 6 j |

**Points de rupture identifiés** : V4-D (marge 0, il conditionne 3 lots) · dernière paire V5-C (marge 1 j) · SEC-REVIEW (1 j) · **CANAL-E (marge réelle nulle)**.

---

## 3. Calendrier daté (jours ouvrés réels, lun-ven)

### S3 — 16 → 20/11 : clôture de la vague 4

| Date | Lots | Fin de journée |
|---|---|---|
| **Lun 16/11** | V4-D (reste) + V4-G ★ | éligibilité sourcée + couverture donnée mesurée |
| **Mar 17/11** | V4-E (2 h) + V5-B (1 h 30) | V3-09 livré ou « non faisable » prouvé |
| **Mer 18/11** | V4-F (1 h 30) + V5-D (1 h) | **→ M1′ : VAGUE 4 CLOSE** |
| **Jeu 19/11** | V5-C paire 1 (2 h) + BACKUP ★ (1 h) | 2 sources gouvernementales de plus |
| **Ven 20/11** | V5-C paire 2 (2 h) + V5-E (2 h) | 4/8 sources · token dédié + rotation demandée |

### S4 — 23 → 27/11 : dettes, canal, audit

| Date | Lots | Jalon |
|---|---|---|
| **Lun 23/11** | V5-C paire 3 (2 h) + **CANAL-E ★ (2 h)** *si SMTP posé* | 6/8 sources |
| **Mar 24/11** | V5-C paire 4 (2 h) + P3 (2 h) | **fin V5-C** (8/8) |
| **Mer 25/11** | Buffer / rattrapage + P4 (1 h 30) | **M2 : DETTES V5 CLOSE** |
| **Jeu 26/11** | **SEC-REVIEW ★ (2 h)** + P5 (1 h 30) | rapport sécurité livré |
| **Ven 27/11** | Batterie harnais live + mise à jour `registre-risques.md` + `problems-found-produit.md` | **M3 : CLÔTURE D'AUDIT** |

### S5 — 30/11 → 07/12 : ouverture et mesure

| Date | Étape | Critère |
|---|---|---|
| **Lun 30/11** | **G1 — ouverture accompagnée** : 20 vrais étudiants (action utilisateur) | 20 profils réels, opt-in posé |
| **Mar 01/12** | **1re notification réelle délivrée** (email) | 0 % → 1 envoi prouvé |
| **Ven 04/12** | Point de mesure lecture / réponse | taux calculé, pas estimé |
| **Lun 07/12** | **M4 — go/no-go > 30 %** + baseline North Star | candidatures déclarées / semaine |

---

## 4. Jalons révisés (remplacent ceux du 06/11)

| Jalon | Ancienne date | Date révisée | Contenu |
|---|---|---|---|
| ~~M1~~ | ven 13/11 | **M1′ = mer 18/11** | vague 4 close (V4-A→V4-F) |
| M2 | mer 25/11 | **mer 25/11 (inchangé)** | dettes V5 closes |
| M3 | ven 27/11 | **ven 27/11 (inchangé)** | clôture d'audit |
| G1 | lun 30/11 | **lun 30/11 (inchangé)** | ouverture, 20 étudiants |
| M4 | lun 07/12 | **lun 07/12, conditionnel** | go/no-go > 30 % — tombe si SMTP absent (voir §5) |

---

## 5. Ce qui devient intenable si les credentials SMTP ne sont pas posés

Chaîne de rupture, sans hypothèse :

`CANAL-E (23/11) → P4 (25/11) → P5 (26/11) → 1re notification (01/12) → seuil 30 % (07/12) → M4`

- **CANAL-E ne peut pas démarrer** : aucun envoi réel possible, le harnais resterait mocké.
- **P4 et P5 sont sans objet** : mesurer un canal qui n'émet pas ne produit aucune donnée.
- **G1 (30/11) tient quand même** : l'acquisition de 20 étudiants est une action indépendante du canal.
- **Mais le produit ne tient pas sa promesse centrale** : 0 notification délivrée à l'ouverture, exactement le problème que le prototype devait trancher.
- **M4 devient un go/no-go sans mesure** : un seuil de 30 % ne se calcule pas sur 0 envoi.

**Date limite ferme : lundi 23/11** (créneau CANAL-E). Après cette date, M4 glisse au **lundi 14/12** et l'ouverture doit se faire avec un **canal de remplacement manuel** (WhatsApp manuel si la vérification Meta aboutit, sinon envoi ciblé hors plateforme), en le disant explicitement aux étudiants.

**Seconde porte, non planifiable** : la rotation des clés Supabase (attente depuis le 11/10) conditionne V5-E et donc SEC-REVIEW. Sans elle, M3 se fait **sous réserve**, risque #10 (base jamais auditée) restant ouvert.

---

## 6. Portes communes à CHAQUE lot (AGENTS.md)

1. Session = 1 lot nommé, **≤ 2 h**, coupé **avant** épuisement = 1 branche = 1 commit + 1 harnais + note de reprise 5 lignes.
2. KPI : `mesure-tokens.ps1 -Snap` avant / `-Diff -Label <nature>` après → `kpi-suivi.md`.
3. Gates avant commit : `py_compile` + `ruff` (API), `tsc --noEmit` + `eslint` (web), `vitest`, `scripts/test-*.py` — **jamais de build** en tâche courante.
4. Déploiement → **preuve live** (`verify-live-public` + `verify-fiche-bourse`) ; contrôle négatif joué **avant** déploiement.
5. Tout endpoint `/api/v1/*` → proxy Next local relayant `Authorization` ; admin = relais `Cookie` + `x-admin-token` + `Authorization`.
6. **Zéro migration SQL** → clés dans `offres.metadata` / `profils.metadata` ; écriture enum bridée, lecture union SQL ; « 100 % bourses » au point d'écriture `BaseScraper.save`.
7. Identité : **jamais** présenter `lawol.mr` comme URL fonctionnelle (DNS = NXDOMAIN) ; API = `https://lawol-api.onrender.com`.

---

## 7. Ce qui peut encore faire glisser

- **V4-D non livré le 14/11** → toute la chaîne V4 décale d'un jour, M1′ passe au 19/11 (absorbé par la marge de V5-B, pas par celle de V5-C).
- **V4-G à 0 ligne** (MESRS) → V4-E/V4-F livrent le verdict « non faisable, preuve » : M1′ tient, mais V3-09 / V3-10 ne sont pas livrés.
- **Cold start Render (plan free)** : 30 à 90 s sur la première requête après 15 min d'inactivité — à mesurer en V5-B, à ne pas confondre avec une panne API.
- **Token MCP Supabase invalide** : depuis le 14/11, la base n'est plus contrôlable automatiquement (backups, santé, logs). Le statut BACKUP du §1 est donc une **reprise**, pas une mesure.
- **WhatsApp Meta** : décision hors planning (vérification entreprise + budget).
