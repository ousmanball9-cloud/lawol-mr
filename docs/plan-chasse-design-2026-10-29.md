# Plan — Chasse design & system design (LAWOL.mr)

Date : 29/10/2026 · Statut : **plan à valider** · Auteur : régisseur

## 0. Ce qu'on chasse (et ce qu'on ne chasse pas)

Deux objets distincts, souvent confondus — la chasse les traite séparément :

| Objet | Définition | Livrable de la chasse |
|---|---|---|
| **Design system** | tokens (couleur, typo, espace, rayon, ombre, motion), composants, états, doc d'usage | `docs/design-system-v2.md` + tokens consolidés |
| **System design** | architecture d'information, navigation, parcours (recherche → fiche → candidature → suivi), flux API↔UI | `docs/system-design-v2.md` + schémas de flux |

Ce qu'on ne fait **pas** : copier des assets, du code ou des textes. On extrait des
**patterns** (structure, hiérarchie, comportement), jamais une identité visuelle.

## 1. Objectif mesurable

| Axe | Aujourd'hui | Cible 6 semaines | Mesure |
|---|---|---|---|
| Complétude DS | tokens Tailwind + 5 classes utilitaires (`fond-nuit`, `lueur-nuit`…) | 100 % des composants couverts (états vide/erreur/chargement/succès) | inventaire composants vs doc |
| Cohérence visuelle | « Nuit d'Indigo » appliquée page par page | 0 régression, 0 noir, 1 seule source de tokens | `npm run verify:design` + grep zéro-noir |
| Parcours étudiant | recherche → fiche → postulation, sans suivi central | tunnel instrumenté, 3 étapes max par action clé | parcours documenté + probes live |
| Accessibilité | WCAG 22/22 sur les pages testées | AA sur 100 % des pages publiques + admin | audit automatisé par route |

## 2. Sources (5 familles, 12 sites max — pas plus, sinon la chasse se dilue)

### A. Cœur métier — bourses & stages (le plus rentable)
| Site | Ce qu'on lui prend |
|---|---|
| `jobteaser.com` | anatomie carte offre, filtres, espace étudiant |
| `joinhandshake.com` | matching étudiant↔offre, onboarding profil |
| `mastersportal.com/scholarships` (ex-`scholarshipportal.eu`, 301) | moteur de bourses : filtres pays/niveau/financement, facettes partageables |
| `daad.de` | fiche bourse : éligibilité, échéances, checklist documents |
| `campusfrance.org` | parcours « candidater », confiance institutionnelle |
| `chevening.org` | storytelling de bourse, timeline de candidature |
| `stipendiumhungaricum.hu` | portail national de bourses, statut de dossier |
| `turkiyeburslari.gov.tr` | formulaire multi-étapes, suivi de candidature |

### B. Référence design system (qualité d'exécution)
`stripe.com` (densité + clarté), `linear.app` (hiérarchie sobre), `airbnb.com`
(cartes + confiance), `notion.so` (états vides utiles).

### C. Benchmark interne (pas un site — obligatoire avant toute chasse)
Inventaire de l'existant : `apps/web/components/**`, `app/**`, `globals.css`,
`tailwind.config.ts`, briefs `docs/brief-design*.md`.

Règle : **une fiche par site**, maximum 8 constats par site (anti-dérive,
même borne que `diablo`/`auditeur`).

## 3. Grille d'extraction (unique, identique pour tous les sites)

Chaque constat est une ligne de fiche, jamais un paragraphe :

```
ID | Site | Écran/URL | Constat (1 phrase) | Catégorie | Preuve | Effort | Impact
```

- **Catégorie** : `token` · `composant` · `IA` · `parcours` · `confiance` · `mobile` · `perf`
- **Preuve** : screenshot daté dans `docs/chasse/captures/<site>-<ecran>.png` + date de capture
- **Impact** : 1-5 (étudiant : trouve-t-il/ose-t-il postuler ?) · **Effort** : 1-5 (jours-homme)
- Un constat sans preuve visuelle **est rejeté** au tri (règle de preuve du workspace).

## 4. Déroulé — 6 chasses, 1 brief = 1 tâche = 1 agent

| # | Chasse | Contenu | Agent | Sortie |
|---|---|---|---|---|
| 0 | **Inventaire** | cartographie DS + parcours actuels (lecture seule) | `explore` | `docs/chasse/00-etat-des-lieux.md` |
| 1 | **Tokens & langage** | palette, typo, espace, rayon, ombre, motion sur 4 réf. classe B | `general` + skill `design-extractor` | `01-tokens.md` |
| 2 | **Carte & fiche offre** | anatomie de carte, badges, fiche, CTA | `general` | `02-carte-fiche.md` |
| 3 | **Recherche & IA** | barre, filtres, tri, pagination, navigation mobile | `general` | `03-recherche-ia.md` |
| 4 | **Parcours & confiance** | onboarding, documents, statut de dossier, réassurance | `general` | `04-parcours.md` |
| 5 | **Mobile & perf** | densité 390px, gestes, LCP/CLS perçus | `general` | `05-mobile-perf.md` |
| 6 | **Synthèse & arbitrage** | fusion, dédoublonnage, score RICE, plan d'implémentation | `architecte` | `docs/design-system-v2.md` + `system-design-v2.md` + backlog |

Ordre : 0 d'abord (obligatoire), puis **2 → 3 → 4 → 1 → 5** (priorité validée
29/10 : **catalogue** — trouver la bonne offre vite), deux chasses en parallèle
maximum (agents `background`, fichiers disjoints), puis 6 en séquentiel (dépend
de tout).

Chaque chasse : budget **1 session**, 8 constats max, captures incluses.

## 5. Garde-fous

1. **Légal** : scraping interdit derrière authentification ; respect `robots.txt` ;
   aucune reproduction de logo/asset/texte. Extraction = propriétés mesurées.
2. **Charte LAWOL prime** : « Nuit d'Indigo » reste la source de vérité, zéro noir.
   Un pattern concurrent n'entre que s'il **s'insère** dans les tokens existants ;
   sinon il va au backlog avec la mention « exige un token nouveau ».
3. **Zéro régression** : toute idée retenue passe la gate complète —
   `npm run lint` · `npm run build` · `npm run verify:design` (WCAG 22/22,
   matrice 39/39, largeur 8/8) · `verify-live-public.mjs` · grep zéro-noir.
4. **Ne jamais** affaiblir un `expect` pour faire passer un test : changer le probe.
5. **Pas de build** pendant les chasses 0-5 (lecture seule). Aucun fichier de
   `apps/` modifié avant la validation de la synthèse.
6. **Mémoire** : décision structurante → `decision-log-produit.md` ;
   bug corrigé → `problems-found-produit.md`.

## 6. Backlog de sortie (format unique)

| Pattern | Source | Catégorie | Impact | Effort | RICE | Décision |
|---|---|---|---|---|---|---|
| … | url + capture | token/composant/… | 1-5 | 1-5 | (I×confiance)/E | à faire / plus tard / rejeté |

Le backlog vit dans `docs/chasse/backlog.md` ; il est priorisé à la fin de la
chasse 6, **jamais** en cours de route (anti-scope-creep).

## 7. Risques

| Risque | Parade |
|---|---|
| Chasse infinie (« encore un site ») | 12 sites plafond, 8 constats/site, 1 session/chasse |
| Constats inapplicables (site US, autre public) | filtre : le pattern sert-il un étudiant mauritanien sur mobile ? |
| Copie d'identité visuelle | charte LAWOL + revue `relecteur` sur la synthèse |
| Perte de preuves entre sessions | captures versionnées dans le dépôt, pas dans un dossier temporaire |
| Refonte qui casse le live | gates vertes obligatoires + `verify-live-public` après déploiement |

## 8. État d'avancement (29/10/2026, 21:30)

| Chasse | Statut | Livrable |
|---|---|---|
| 0 — inventaire | ✅ mesuré + contrôlé par le régisseur | `docs/chasse/00-etat-des-lieux.md` |
| 2 — carte & fiche | ✅ mesuré (DOM 375 px) + contrôlé | `docs/chasse/02-carte-fiche.md` |
| 3 — recherche & filtres | ✅ mesuré (390/1280 px) | `docs/chasse/03-recherche-ia.md` |
| 1 — tokens | ✅ mesuré par le régisseur (agent en échec quota) | `docs/chasse/01-tokens.md` |
| 4 — parcours & confiance | ✅ mesurée par le régisseur (agents en échec quota) | `docs/chasse/04-parcours.md` |
| 5 — mobile & perf | ✅ mesurée par le régisseur (3 passages + accueil) | `docs/chasse/05-mobile-perf.md` |
| 6 — synthèse | ✅ faite par le régisseur | `chasse/backlog.md`, `docs/design-system-v2.md`, `docs/system-design-v2.md` |

Découverte de source : `scholarshipportal.eu` → **301** vers `mastersportal.com`
(la référence du plan est corrigée).

**Prochaine action** : vague 1 du backlog (12 items, ≤ 2 j, aucun risque fonctionnel) —
commencer par les 3 violations « zéro noir » et le CTA collant de fiche.

## 9. Décisions prises (29/10/2026)

- **Priorité produit : 3 = catalogue.** Ordre d'exécution 0 → 2 → 3 → 4 → 1 → 5 → 6.
- **Cause d'incohérence supprimée** : `docs/brief-design-premium.md` (direction
  pré-D26, near-black `#0A0A0A`, contredisait la charte) → corbeille réversible
  (`corbeille.ps1 -Restaurer corbeille-20261029-130159-brief-design-premium.md`).
  `brief-navigation.md` et `brief-desktop-layout.md` (mêmes mentions `bg-ink`
  near-black) portent désormais un en-tête **PÉRIMÉ** : conservés comme
  historique, non applicables.
