# Maîtrise du changement - Migration Railway vers Render (LAWOL)

> Fiche `CC-2026-001` - statut : **APPROUVÉ, bascule faite et prouvée**. Changement : 12-13/11/2026. Rédigé le 14/11/2026.
> Sources : `git log` du 12 au 14/11 (14 entrées, dont 4 merges), `docs/migration-render-2026-11-12.md`, `docs/migration-cloudrun-2026-11-12.md` (archive),
> `docs/calendrier-2026-11.md` (révision du 14/11), `.github/workflows/scraper-cron.yml`, `render.yaml`, `apps/web/lib/api-url.ts`, `AGENTS.md` du projet.
> Périmètre : hébergement de l'API. Aucune donnée déplacée, aucune migration SQL.

## 1. Résumé du changement et pourquoi il a eu lieu

L'API de production est passée de Railway à Render. Elle répond sur `https://lawol-api.onrender.com`
(service `srv-dbr2mglbedkc738p2nb0`, plan free, région frankfurt, Docker, `autoDeploy: true` sur
`main`) - source : `docs/migration-render-2026-11-12.md` section 1. Le déclencheur n'est pas un choix
produit : **l'essai Railway est arrivé à son terme** et l'ancienne adresse répondait `Application not
found` sur tous les chemins (même document, en-tête). Il fallait remettre l'API en ligne. Cloud Run,
préparé puis écarté car la Mauritanie ne figure pas dans les pays de facturation Google Cloud
(`ba9d6fd`), laisse la place à Render free (`f26f735`).

Le changement ne s'est pas limité à un redéploiement. Six corrections l'ont rendu tenable :

| Correctif | Commit | Effet |
|---|---|---|
| URL API centralisée dans `apps/web/lib/api-url.ts` | `046b5a4` | 34 proxys `app/api/**` et 2 harnais ne recopient plus d'URL ; défaut = Render |
| Durcissement du script de déploiement | `7c678b2` | URL vide refusée, code de sortie propagé, attente plafonnée à 40 min, 20 cas hors ligne |
| Readiness `/health/ready` | `593954c` | 200 si Supabase répond, 503 sinon ; `/health` intact car Render pointe dessus |
| CI vers l'hôte Render (`scraper-cron`, `resume-hebdo`) | `aff8d47`, `4dba273` | les crons appellent la bonne API |
| Collecte source par source | `1c55991` | un appel de 16 sources ne dépasse plus le délai du proxy |
| Avertissement anti-doublon dans `render.yaml` | `4c4e7c5` | le blueprint ne doit jamais être appliqué : 2 services couperaient les 750 h/mois en deux |

## 2. Analyse d'impact

**Technique.** 37 fichiers touchés par `046b5a4` (34 routes proxy, `lib/api-url.ts`, 2 harnais `verify-*.mjs`),
49 insertions / 70 suppressions : un seul point de vérité. Le `Dockerfile` racine écoute `${PORT}`
(runbook section 6) ; `/health` est inchangé, le probe Render continue de fonctionner.

**Coût.** Plan free : 0 euro, sans carte bancaire, **sans SLA** ; 750 h/mois partagées sur le workspace Lawol
(`docs/migration-render-2026-11-12.md` sections 1 et 8 ; en-tête de `render.yaml`). Aucune ressource payante.

**Risque.** Deux risques nouveaux, acceptés et documentés : réveil de 30 à 90 s après environ 15 min d'inactivité,
absence de SLA. Risque fermé par écrit : le doublon créé par une application du blueprint, identifié par id
et non par nom (`render.yaml`, runbook section 8).

**Délai consommé.** 2 jours ouvrés, 12 et 13/11/2026, de `ba9d6fd` (12/11 20:17) à `1c55991`
(13/11 12:37). Ce créneau n'existait pas dans le plan maître v1.0 du 06/11, qui planifiait la phase 2
du 07/11 au 21/11 sans budget d'infrastructure. Effet net tracé dans `docs/calendrier-2026-11.md` :
**M1 du 13/11 reporté à M1' du 18/11** (+3 jours ouvrés), M2 (25/11), M3 (27/11) et G1 (30/11)
inchangés. Le retard est absorbé par la marge du planning, pas par une réduction de périmètre.

## 3. Impact produit visible pour l'étudiant

- **Première requête lente.** Après 15 min sans trafic, le conteneur se réveille : 30 à 90 s, parfois
  plus juste après un déploiement (runbook section 4). C'est un réveil, **pas une panne** ; un test
  manuel qui expire se relance une fois avant toute conclusion (même section).
- **Ce que l'étudiant voit :** un délai avant l'affichage des offres, pas une erreur durable ; le cron
  `scraper-cron.yml` retente 3 fois sur 5xx et réseau, ce qui absorbe le réveil.
- **Ce qui ne change pas :** le site public reste `https://lawol-mr.vercel.app` ; parcours, offres et
  données sont identiques, l'état vit dans Supabase (archive Cloud Run, section "Etat").
- **Interdit de communication :** `lawol.mr` reste NXDOMAIN et ne doit **jamais** être présenté comme
  une URL fonctionnelle (`AGENTS.md` du projet, lignes 70-71 ; `docs/calendrier-2026-11.md`, porte 7).
- **Effet de bord corrigé :** une collecte pouvait paraître échouée alors qu'elle tournait. Mesure du
  13/11 : appel global de 16 sources, 3 réponses 502 (run `43416879208`), `sante-collecte` ne voyant
  que 6 sources traitées ; après découpage, 16/16 sources en environ 2,5 min (run `43418764051`,
  mesure consignée dans `AGENTS.md` racine du workspace, section 7).

## 4. Plan de communication

| Public | Message | Canal | Quand | Règle |
|---|---|---|---|---|
| Étudiants actuels | "La plateforme est de nouveau en ligne. Si la première page met jusqu'à une minute à s'ouvrir, c'est un réveil du serveur : attendez ou rechargez une fois." | Email (opérationnel) et WhatsApp quand Meta aboutit | Avant G1 (30/11) | Ne jamais parler de Railway, de Render ni de "panne serveur" |
| Nouveaux étudiants | Argument inchangé : accès gratuit aux bourses, aide à postuler, suivi | WhatsApp, bouche à oreille | G1 | Le réveil est présenté comme une lenteur possible, pas un incident |
| Partenaires, écoles | "Migration d'hébergement terminée, service vérifié, aucune donnée perdue. Pas encore de SLA sur le plan actuel." | Note de 5 lignes, chiffres du runbook | Dès la demande | Chiffrer et sourcer, jamais promettre une disponibilité |
| Fondateur | Coût 0, risques ouverts, jalon M1' 18/11 | Ce document | Hebdomadaire | Rien en comité qui n'ait été dit avant aux concernés |

Règle de crise : 1 déclencheur, 1 porteur, 1 délai. Si l'API est injoignable après 2 relances à 90 s, vérifier `GET https://lawol-api.onrender.com/health/ready` : un 503 désigne la base, pas l'hôte.

## 5. Mesures d'adoption et de repli

| Indicateur | Cible | Seuil rouge | Mesure |
|---|---|---|---|
| Disponibilité applicative | `/health/ready` = 200 | 503 sur 2 contrôles de suite | appel direct à `/health/ready` |
| Réveil perçu | moins de 90 s | plus de 180 s | chronométrage de la 1re requête (lot V5-B) |
| Collecte | 16/16 sources | moins de 12 | `sante-collecte` après chaque cron |
| Crons | 2 runs verts par jour | 1 échec 2 jours de suite | onglet Actions GitHub |
| Erreurs proxy | 0 5xx sur inscription | 5xx visible par un étudiant | journaux Next et Render |

**Repli, du moins cher au plus lourd** (runbook section 6) : (1) rollback Render du dernier déploiement
sain, sans git, immédiat ; (2) `git revert` du commit fautif puis push, `autoDeploy` reconstruit
l'image précédente ; (3) changer d'hôte, dernier recours, l'API ne dépendant d'aucune ressource Render
propre. **À refaire alors** : `NEXT_PUBLIC_API_URL` côté Vercel (ou le défaut de `apps/web/lib/api-url.ts`),
les 2 URL en dur de `scraper-cron.yml` et `resume-hebdo.yml`, la section Identité de `AGENTS.md`, puis
`scripts/preuve-api.ps1 -Base <url>` ; le reste du code suit. **Un retour vers Railway n'est pas une
option** : le service n'existe plus (runbook, section 6).

## 6. Risques (probabilité x impact)

| # | Risque | P | I | Criticité | Réponse |
|---|---|---|---|---|---|
| 1 | Le réveil de 30-90 s est lu comme une panne et l'étudiant abandonne | Forte | Moyen | **Élevée** | Message de lancement, relance côté cron, mesure en V5-B |
| 2 | Plan free sans SLA : suspension ou coupure non planifiée | Moyenne | Fort | **Élevée** | Un seul service, jamais de blueprint, surveillance `/health/ready` |
| 3 | Doublon de service par le blueprint : 750 h/mois divisées, probe mal dirigé | Moyenne | Fort | **Élevée** | Avertissement en tête de `render.yaml`, identification par id `srv-dbr2mglbedkc738p2nb0` |
| 4 | `SCRAPER_TOKEN` absent ou différent de `ADMIN_PASSWORD_HASH` : crons en échec silencieux | Moyenne | Moyen | **Moyenne** | Vérification du secret dans le workflow, aucun retry sur 401/403 |
| 5 | Hébergeur unique, 2 URL encore en dur dans les workflows | Faible | Moyen | **Moyenne** | `lib/api-url.ts` comme source unique, procédure de changement d'hôte écrite |

Hors périmètre, non refermé : `lawol.mr` sans DNS et SMTP absent depuis le 10/11 (`docs/calendrier-2026-11.md`, sections 0 et 5) - portes externes.

## 7. Leçons transposables

1. **Un appel HTTP long derrière un proxy se découpe.** L'appel global de 16 sources dépassait environ
   110 s et rendait 502 alors que le travail continuait côté serveur : état métier d'abord, code HTTP
   ensuite (`scraper-cron.yml`, `1c55991`).
2. **Une URL copiée 34 fois est 34 occasions d'oublier.** Centraliser avant de changer d'hôte, pas
   pendant (`046b5a4`).
3. **Identifier une ressource par son id, jamais par son nom.** Deux services Render peuvent porter le
   même nom ; seule l'id distingue celui qui sert le front (`render.yaml`).
4. **Une preuve doit refuser une cible vide.** Le 12/11, un `-Base ""` donnait un VERT sur l'API locale
   au lieu de la production ; le harnais échoue désormais avant tout appel réseau (`preuve-api.ps1`).
5. **Un harnais vérifie un invariant, pas une forme littérale.** Exiger un en-tête écrit d'une seule
   façon produit un faux rouge alors que la sécurité est intacte (13/11, `test-garde-admin.py`).
6. **Un plan sans budget d'infrastructure paie le prix sur ses jalons.** 2 jours ouvrés non prévus ont
   coûté 3 jours ouvrés de jalon (M1 vers M1') : le prochain plan maître doit porter une ligne
   "infrastructure et hébergement" avec sa marge.
