# 🗺️ Plan Maître LAWOL — Version 1.0

> **Objet** : plan détaillé et piloté pour faire passer LAWOL du prototype à la plateforme opérationnelle, puis à la croissance.
> **Statut** : document vivant — consulté à chaque session, modifié si nécessaire.
> **Dernière mise à jour** : 06/11/2026
> **Pilote** : Régisseur (système) + Fondateur (utilisateur)

---

## 0. Synthèse exécutive

| Élément | Détail |
|---------|--------|
| **Projet** | LAWOL.mr — Plateforme bourses/stages 100 % dédiée aux étudiants mauritaniens |
| **Problème** | 3 difficultés : accès aux bourses, ne sait pas postuler seul, pas de suivi de candidature |
| **Cible** | Bacheliers, licenciés, tous élèves et étudiants mauritaniens |
| **Vision** | Plateforme et application de bourse pour les Mauritaniens ; hub éducatif panafricain (3-5 ans) |
| **Modèle économique** | Accès gratuit aux bourses ; accompagnement de postulation + suivi de candidature payants |
| **Canal principal** | Email (opérationnel) ; WhatsApp (en attente de vérification Meta) |
| **North Star** | Candidatures déclarées / semaine |

---

## 1. Phase 1 — Prototypage « Boucle de promesse » (P1 → P5)

**Objectif** : valider l'hypothèse non prouvée — *un étudiant reçoit une notification et réagit* — avant d'investir dans l'ingestion de masse.

**Durée totale estimée** : ~9 heures (5 lots bornés)

| Lot | Objectif | Livrables | Durée | Dépend de | Critère de succès |
|-----|----------|-----------|-------|-----------|-------------------|
| **P1** | État des lieux mesuré | `scripts/couverture-notifications.py`, `docs/prototypage-promesse.md` | 1 h | — | Self-test vert (14 checks), 3 pièges bloqués, ruff clean |
| **P2** | Preuve canal email live | `scripts/verify-envoi-live.py`, section P2 doc | 2 h | P1 | Script termine code 0, email accepté + `notifie=true` en base |
| **P3** | Garde-fous opt-in / anti-spam / STOP | `notifier.py` modifié, `test-notifications.py` étendu, section P3 doc | 2 h | P2 | 100% checks verts, 3 contrôles négatifs bloqués, ruff clean |
| **P4** | Run en production + première métrique | Proxy Next `api/v1/notifications/run/route.ts`, run prod | 1,5 h | P2 | 401 sans identité, 403 cookie invalide, 200 avec identité, preuve live verte |
| **P5** | Email manuel + seuil de décision | Runbook dans `prototypage-promesse.md`, comptage réponses | 1,5 h | P4 | 3 meilleures offres envoyées manuellement, réponses comptées, seuil >30% → continuer |

**Gates communs à chaque lot** (AGENTS.md) :
- Session = 1 lot nommé ≤ 2 h = 1 branche = 1 commit + 1 harnais + note de reprise (5 lignes)
- `py_compile` + `ruff check` (API) · `tsc --noEmit` + `eslint` (web)
- `scripts/test-*.py` avant chaque commit
- Aucun nouvel endpoint sans proxy Next ; aucune colonne SQL (tout en `metadata` jsonb)
- Aucun build dans les tâches courantes
- Déploiement → preuve live `verify-live-public.mjs` + `verify-fiche-bourse.mjs`

---

## 2. Phase 2 — Validation et mesure (V1.0)

**Objectif** : confirmer que le canal email fonctionne, mesurer l'engagement, décider du go/no-go WhatsApp.

**Durée estimée** : ~2 semaines (du 07/11 au 21/11)

| Étape | Action | Responsable | Durée | Critère de succès |
|-------|--------|-------------|-------|-------------------|
| **2.1** | Exécuter P2 en live (1 email réel) | Fondateur + Régisseur | 30 min | Email délivré, `notifie=true` en base |
| **2.2** | Exécuter P4 (run en production) | Régisseur | 1 h | Proxy fonctionne, 401/403/200 OK |
| **2.3** | Exécuter P5 (3 envois manuels email) | Fondateur | 1 h | 3 envois, réponses comptées |
| **2.4** | Mesurer le seuil de réponse | Régisseur | 1 jour | Taux de réponse > 30% → go WhatsApp ; < 30% → revoir offre/matching |
| **2.5** | Si go : activer WhatsApp (quand Meta vérifié) | Fondateur | Dès dispo | 1 envoi WhatsApp réussi |

**Décision de porte** : si < 30% de réponse sur P5 → problème offre/matching, pas de canal. Revoir la sélection des offres avant de continuer.

---

## 3. Phase 3 — Lancement et ouverture (G1 → M4)

**Objectif** : acquérir les 20 premiers vrais étudiants, délivrer la 1re notification réelle, atteindre le go/no-go > 30%.

**Calendrier** (d'après l'agent `planificateur`) :

| Date | Jalon | Action | Responsable |
|------|-------|--------|-------------|
| **Lun 30/11** | **G1 — Ouverture accompagnée** | Acquisition de 20 vrais étudiants (action utilisateur) | Fondateur |
| **Mar 01/12** | **1re notification réelle délivrée** | Email envoyé via canal prod (0% → 1) | Régisseur |
| **Ven 04/12** | Point de mesure | Taux de lecture/réponse | Régisseur |
| **Lun 07/12** | **M4 — Go/No-go > 30%** | Baseline North Star (candidatures déclarées/semaine) | Fondateur + Régisseur |

**Alertes** :
- **Credentials SMTP** : en attente depuis le 10/11 — à fournir avant CANAL-E (18/11 prévu)
- **Rotation clés Supabase** : en attente depuis le 11/10 — à faire dans V5-E

---

## 4. Phase 4 — Données et ingestion (V4/V5)

**Objectif** : enrichir le catalogue de bourses, améliorer la pertinence du matching, stabiliser la plateforme.

**Lots V4 (ingestion)** :

| Lot | Contenu | Durée | Dépend de | Preuve |
|-----|---------|-------|-----------|--------|
| **V4-A** | Contrat `metadata` (déjà fait) | 1 h | — | Contrat + harnais vert |
| **V4-B** | Extraction montant | 2 h 30 (B1/B2) | V4-A | Compteur X/281 extraits |
| **V4-C** | Affichage montant carte+fiche | 1 h 30 | V4-B | Harnais live + contrôle négatif |
| **V4-D** | Éligibilité par origine | 2 h 30 (D1/D2) | V4-A | Taux de couverture + fiche sourcée |
| **V4-E** | V3-09 calendrier de sélection | 2 h | V4-D + V4-G | ≥ 2 étapes datées OU verdict « non faisable » |
| **V4-F** | V3-10 dates par pays | 1 h 30 | V4-E | Harnais non-régression échéance |
| **V4-G ★** | Prérequis donnée (calendrier/dates_par_pays) | 2 h | — | Taux couverture `couverture-metadata.py` |

**Lots V5 (dettes et sécurité)** :

| Lot | Contenu | Durée | Dépend de | Preuve |
|-----|---------|-------|-----------|--------|
| **V5-A** | Filtres `financement`+`cloture30` serveur | 2 h 30 | — | Mesure avant/après |
| **V5-B** | TTFB froid : instrumenter, isoler | 1 h 30 | — | Chiffres, aucune promesse |
| **V5-C ×4** | 8 sources gouvernementales par paires | 2 h/paire | — | Run réel + `verify-sante-collecte` |
| **V5-D** | Rejouer `POST /matching/run` en prod | 1 h | — | Distribution + écart max |
| **V5-E** | `SCRAPER_TOKEN` dédié + rotation clés Supabase | 2 h | — | Preuve 401/403 |

**Lots ★ (priorités registre-risques)** :

| Lot | Contenu | Durée | Dépend de | Preuve |
|-----|---------|-------|-----------|--------|
| **CANAL-E ★** | SMTP réel + 1re notification email envoyée | 2 h | Credentials user | Envoi réel prouvé + harnais |
| **BACKUP ★** | Vérifier/configurer backups Supabase | 1 h | — | Statut backup daté |
| **SEC-REVIEW ★** | Revue sécurité avant ouverture | 2 h | Tous lots code + V5-E | Rapport sév:fichier:ligne + correctifs |

---

## 5. Phase 5 — Croissance et monétisation (à partir de 07/12/2026)

**Objectif** : passer du prototype à un modèle générant du revenu, étendre la base utilisateur.

| Étape | Action | Durée | KPI ciblé |
|-------|--------|-------|-----------|
| **5.1** | Définir le prix de l'accompagnement payant | 1 semaine | Taux de conversion > 0 |
| **5.2** | Identifier et contacter les partenaires locaux | 2 semaines | 3 partenariats signés |
| **5.3** | Évaluer les sponsors (universités étrangères, fondations) | 2 semaines | 1 sponsor potentiel |
| **5.4** | Construire les tableaux de bord KPI | 1 semaine | 5 KPIs suivis en temps réel |
| **5.5** | Lancer l'accompagnement payant (pilote) | 1 mois | 5 étudiants payants |
| **5.6** | Évaluer l'extension à d'autres pays (Sénégal, Mali, CI) | 3 mois | Décision go/no-go |

---

## 6. KPIs et seuils de décision (5 KPIs retenus)

| KPI | Définition | Objectif | Source de mesure |
|-----|------------|----------|------------------|
| **KPI 1 — North Star** | Candidatures déclarées / semaine | Croissance mensuelle | Base de données + déclaration utilisateur |
| **KPI 2 — Seuil de réponse** | % d'étudiants qui lisent/répondent aux notifications | > 30% (go/no-go) | Logs email + réponses |
| **KPI 3 — Taux de conversion** | % d'étudiants qui prennent l'accompagnement payant | À définir après pilote | Stripe / paiements |
| **KPI 4 — Couverture offre** | Nombre de bourses affichées / mois | Croissance mensuelle | Catalogue `offres` |
| **KPI 5 — Base active** | Nombre d'étudiants inscrits actifs (opt-in + connectés) | Croissance mensuelle | Table `profils` + `metadata.optin_at` |

**Seuil de décision majeur** : si KPI 2 < 30% après P5 → problème offre/matching, pas de canal. Arrêter l'envoi et revoir la sélection des offres.

---

## 7. Responsabilités et pilotage

| Domaine | Responsable | Outil/Support |
|---------|-------------|---------------|
| Stratégie entrepreneuriale | Fondateur (utilisateur) | `docs/strategie-entrepreneuriale/` |
| Prototypage technique (P1-P5) | Régisseur (moi) | `docs/prototypage-promesse.md`, `scripts/` |
| Planification et calendrier | Agent `planificateur` | `docs/calendrier-2026-11.md` |
| Revue de code / diff | Agent `relecteur` | Sur demande |
| Audit sécurité | Agent `securite` | Avant ouverture (SEC-REVIEW ★) |
| Débogage | Agent `debogueur` | En cas de bug |
| Tests | Agent `testeur` | `scripts/test-*.py` |

---

## 8. Notes de reprise (modèle, 5 lignes max)

À remplir en fin de chaque session :

```
Lot <ID> : <fait / partiel / bloqué>
Preuve : <harnais + chiffre>
Prochain lot : <ID> — commencer par <fichier 1>, <fichier 2>
Piège : <ce qui a coûté du temps>
Décision structurante : <si prise, tracer dans decision-log-lawol.md>
```

---

## 9. Fichiers de référence (à consulter à chaque session)

| Fichier | Objet |
|---------|-------|
| `docs/strategie-entrepreneuriale/vision-long-terme.md` | Problème, cible, vision, modèle économique, KPIs |
| `docs/strategie-entrepreneuriale/positionnement-marche.md` | Segmentation, avantage compétitif, risques |
| `docs/strategie-entrepreneuriale/modele-economique.md` | Modèle retenu, options, coûts |
| `docs/strategie-entrepreneuriale/decision-log-lawol.md` | Décisions structurantes (index) |
| `docs/strategie-entrepreneuriale/problems-found-lawol.md` | Problèmes identifiés et corrections |
| `docs/strategie-entrepreneuriale/plan-maitre-lawol.md` | **Ce document — plan maître** |
| `docs/prototypage-promesse.md` | Plan P1..P5 détaillé |
| `docs/calendrier-2026-11.md` | Calendrier daté jusqu'au 07/12 |
| `lawol-mr/AGENTS.md` | Règles non négociables du projet |
| `docs/plan-lots-vague4-2026-11-06.md` | Lots V4/V5 détaillés |
| `docs/registre-risques.md` | Risques et priorités |

---

## 10. Prochaine action immédiate

**Exécuter P2 en live** — faire partir le premier email réel via `scripts/verify-envoi-live.py --live --dest <email>`.

**Bloquant identifié** : credentials SMTP nécessaires (en attente depuis le 10/11). Sans eux, impossible de faire partir la première notification réelle.

---

*Ce plan est consulté et modifié à chaque session. Toute décision structurante prise en cours de route doit être tracée dans `decision-log-lawol.md`.*
