# Plan « moteur Bourses à 100 % » — LAWOL.mr

> Evolution du pipeline bourses livré (`brief-bourses.md` → 97 bourses, 5
> sources). Objectif : faire des bourses le **cœur absolu** du produit avant
> toute ouverture stages/emplois. Chaque lot est borné, avec fichiers,
> critère de fin (DoD) et garde-fous réseaux.

## 0. Diagnostic (réel du 2026-10-10, API locale)

| Indicateur | Valeur |
|---|---|
| Offres totales | 154 |
| **Bourses** | **97** |
| emploi_junior | 55 |
| stage_pfe | 2 |
| Sources bourses actives | 5 (scholar-africa 59, corners 14, for-africans 11, desk 9, for-africa 4) |
| Collecte | auto 2×/jour (scheduler) |
| Canal notifications | WhatsApp — **token Meta invalide (401)** → notifications réelles bloquées |
| Alertes deadline (J-12/J-3) | **inexistantes** |
| Matching bourse↔profil | **existe** (`engine.py`) — non tuné pour les bourses |

**Ce qui bloque réellement le « 100 % »** : (1) le canal de livraison, (2) la
qualité/fraîcheur des dates de clôture, (3) le volume de sources. Le reste
(exposition, matching, badges) est déjà en place.

## 1. Ce que « 100 % bourses » veut dire (reformulation honnête)

Le vrai produit n'est pas « une liste de bourses » : c'est **le moteur de
matching + la bonne opportunité livrée au bon moment**. Les bourses sont la
**1ʳᵉ démonstration** de ce moteur (volume élevé, dates claires, enjeu fort
pour l'étudiant) avant d'élargir stages/emplois. « 100 % » = toute l'énergie
de produit concentrée là-dessus maintenant, pas 100 % du catalogue définitif.

## 2. Lots (ordre d'exécution recommandé)

### Lot A — Sources : 5 → 10 (volume + diversité géographique)

Ajouter 4-5 portails **agrégateurs** en privilégiant le pattern déjà maîtrisé
`WpBourseScraper` (API REST WordPress `/wp-json/wp/v2/posts` — 4 des 5
sources actuelles) puis HTML SSR (pattern `ScholarAfricaScraper`).

Candidats à **VÉRIFIER en réel (webfetch) AVANT d'écrire les selectors** —
ne jamais coder un portail non confirmé :
- `scholarshipsforafricans.com` — agrégateur africain, catégories par niveau/pays.
- Portails « bourses <pays> » : AUF (francophonie — Maroc, Tunisie, Sénégal,
  Mauritanie), Campus France / France Éducation international (bourse Eiffel),
  Türkiye Bursları (gouvernement turc), Canada (Vanier / universités).
- Tout portail WP avec catégorie bourses → prioritaire (le plus robuste).

Fichiers : `apps/api/app/modules/scraper/sources/bourses.py` (ajout de
classes), `catalogue.py` (enregistrement SPECIFIQUES).
**DoD** : 10 sources enregistrées ; run réel → chaque source rapporte son
statut (nb offres ou échec isolé) ; total bourses ≥ 150 ; aucune source morte
ne casse les autres (pattern `run()` existant).
**Garde-fous** : UA honnête, throttle 1 req/s global (`_get()` existant),
timeout 10 s, erreurs isolées, zéro dépendance pip.

### Lot B — Qualité des fiches : zéro offre morte

Le repli silencieux `today + 60 jours` (quand la deadline est illisible) fabrique
des dates potentiellement fausses. Deux options à trancher à l'exécution :
1. **Marquer** les offres à date estimée (`date_estimee: bool`) et les distinguer
   côté UI (badge « date à confirmer ») — honnête et rapide.
2. **Exiger** une date lisible pour toute source (comme `WpBourseScraper`) et
   écarter les articles sans deadline — plus strict, moins de faux positifs.

Fichiers : `bourses.py` (champ + `_date_limite`), `shared/models.py`
(champ optionnel), `apps/web` (badge si option 1).
**DoD** : 0 bourse publiée avec une date passée (contrainte déjà Pydantic) ;
toute date estimée est tracée et visible par l'utilisateur ; harnais qui
prouve qu'aucune offre « morte » (date passée) n'apparaît dans `/offres`.

### Lot C — Alertes de deadline J-12 + J-3 (la vraie valeur)

Aujourd'hui la notification ne part que sur les **nouvelles** correspondances.
Ajouter des **rappels** pour une bourse déjà matchée qui se rapproche de sa
clôture. C'est ce qui transforme une « liste » en service vivant (les
concurrents type Scholar Africa font déjà 30/14/3 jours).

Fichiers : `apps/api/app/modules/whatsapp/notifier.py` (nouveau job
`run_deadline_job`), `textes.py` (texte de rappel), `main.py` (endpoint
`/api/v1/notifications/deadlines`), scheduler (cron 2×/jour).
**DoD** : pour chaque profil actif ayant un match bourse, un rappel part à
J-12 puis J-3 (une seule fois par seuil — état persisté) ; opt-out respecté ;
harnais de preuve sur profils de test (supprimés après).

### Lot D — Matching bourse↔profil : tuning

Le moteur exclut les offres à `filieres_cibles` vides (les bourses remplissent
toutes les filières par défaut → matching trop large). Ajuster pour que les
bourses très génériques ne saturent pas l'étudiant.

Fichiers : `apps/api/app/modules/matching/engine.py` (poids/priorité bourse),
éventuellement `_filieres()` dans `bourses.py`.
**DoD** : un étudiant test « informatique + M2 » reçoit des bourses **pertinentes**
(pas 20 bourses toutes filières) ; preuve par le payload `/api/v1/matching/run`.

### Lot E — Canal de livraison (condition du 100 %) — À TRANCHER AVANT PUBLIATION

Le token Meta WhatsApp est invalide (401). Tant que le canal ne marche pas, le
« 100 % » est théorique. Pistes (décision utilisateur requise) :
1. **WhatsApp Business Cloud API** (gratuit jusqu'à un seuil de conversations) —
   corriger le token/numéro ; conformité Meta (opt-in, politique messaging).
2. **Email** (gratuit via un SMTP type Brevo/EmailJS ou un plan gratuit) —
   robuste, universel, moins « live » que WhatsApp.
3. **SMS** — coûteux en Mauritanie, à écarter sauf besoin réel.

Reco : **Email en filet de sécurité + WhatsApp en canal principal** (si token
rétabli). Le code de notification doit rester **canal-agnostique** (interface
unique, backends pluggables) pour basculer sans réécriture.
**DoD** : au moins un canal réel fonctionnel de bout en bout (message reçu par
un vrai destinataire de test) ; le pipeline de matching/alertes (Lots C-D)
fonctionne quel que soit le canal.

### Lot F — Stages/emplois : en veille (volontairement)

55 emploi_junior + 2 stage_pfe restent **non poussés** activement pendant la
focalisation bourses. On garde le catalogue, on n'investit pas en dev dessus
avant que le moteur bourses soit solide. Réévaluer après le Lot E.

## 3. Dépendances & ordre

```
Lot A (sources)  ─┐
Lot B (qualité)  ─┼─> Lot C (alertes) ─> Lot E (canal) ─> [publication]
Lot D (matching) ─┘                      ↑ condition
```
- A, B, D **parallélisables** (fichiers disjoints : sources / models+web / engine).
- C dépend de la base saine fournie par A+B.
- E est la **condition dure** avant publication réelle ; il peut avancer en
  parallèle côté config (token, SMTP) mais la validation finale exige C prêt.

## 4. KPI (critère dur : plus rapide ET moins de tokens)

- **Couverture** : bourses actives (cible ≥ 150), nb de sources actives (10).
- **Fraîcheur** : % de bourses avec date réelle vs estimée (cible : estimées < 10 %).
- **Pertinence** : nb moyen de bourses par profil (cible : 3-8, pas 20).
- **Live** : notifications/rappels réellement reçus sur un canal fonctionnel.
- Chaque dispatch mesure (`-Snap` / `-Diff -Label`) → `kpi-suivi.md`.

## 5. Hors périmètre (volontairement)

- Refonte visuelle (déjà faite : chrome Jobteaser livré).
- Stages/emplois (Lot F — veille).
- Monétisation / espace payant.
