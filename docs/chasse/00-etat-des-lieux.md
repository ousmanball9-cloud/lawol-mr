# Chasse 0 — État des lieux du design system et des parcours

> Périmètre lu : `apps/web/app/**` (hors `app/api/**`), `apps/web/components/**`,
> `globals.css`, `tailwind.config.ts`, `middleware.ts`. Lecture seule, chaque
> affirmation porte sa référence `fichier:ligne`.
> Date : 29/10/2026. Auteur : `explore`, contrôlé par le régisseur.

**Contrôles du régisseur (re-mesurés le 29/10, pas relayés)** :
- violations « zéro noir » : `bg-black/50` (`offre-detail-modal.tsx:363`),
  `#0A0A0A` (`app/layout.tsx:18`), `bg-gray-900/50` (`components/admin/layout.tsx:87`) — **CONFIRMÉES** ;
- `app/admin/profils/page.tsx` : `fetch().then().finally()` sans `.catch` — **CONFIRMÉ** (échec réseau = spinner permanent) ;
- ombres en dur `rgba(10,10,10,…)` : **36 lignes / 38 occurrences / 102 fichiers scannés** — chiffre de l'agent confirmé.

---

## 1. Tokens

### 1.1 Couleurs

| Famille | Déclaration | Mapping Tailwind |
|---|---|---|
| Sémantiques shadcn (light) | `globals.css:19-27` | `tailwind.config.ts:11-19` |
| Sémantiques (dark) | `globals.css:36-44` | idem |
| `--ink` slate #1E293B | `globals.css:30` | `ink` — `tailwind.config.ts:24` |
| `--nuit` indigo #312E81 | `globals.css:31` | `nuit.{DEFAULT,deep,lift}` — `tailwind.config.ts:25` |
| `--signature` #2563EB | `globals.css:32` | `signature.{DEFAULT,deep}` — `tailwind.config.ts:26` |
| `--surlignage` #F59E0B | `globals.css:33` | `surlignage` — `tailwind.config.ts:27` |
| États PIN | — | `amber.500/600`, `emerald.500/600` — `tailwind.config.ts:21-22` |

Points de vigilance mesurés :

- `text-ink` (43 occurrences) et `text-foreground` (68) coexistent pour la **même
  intention** « texte principal » : `app/offres/page.tsx:300` vs
  `components/chrome/notifications-cloche.tsx:230`.
- `bg-primary` (`hsl(221.2 83.2% 53.3%)`, `globals.css:22`) est **exactement**
  `signature` (`globals.css:32`) : deux noms pour une couleur. La variante
  `default` du bouton l'utilise (`components/ui/button.tsx:11`) alors que les CTA
  réels surchargent en `bg-signature` (`components/chrome/header.tsx:51`).

### 1.2 Rayons

- `--radius: 0.5rem` — `globals.css:28` ; `borderRadius.lg/md/sm` dérivés — `tailwind.config.ts:29`.
- Usage réel : `rounded-lg` (cartes) + `rounded-full` (pastilles) — `components/offres/carte-offre.tsx:38`, `:64`.

### 1.3 Typographie

- Inter → `--font-sans` (`app/layout.tsx:7`) · Sora → `--font-display` (`app/layout.tsx:8`).
- Exposition `fontFamily.sans/display` — `tailwind.config.ts:30-33` ; application `app/layout.tsx:29`.

### 1.4 Classes de charte (`@layer components`)

| Classe | Définition | Rôle |
|---|---|---|
| `.eyebrow` | `globals.css:54` | overline capitales `tracking-[0.18em]` |
| `.fond-nuit` | `globals.css:57-59` | dégradé #1E1B4B → #312E81 → #4338CA |
| `.fond-nuit-anime` | `globals.css:61-65` | idem + `derive-nuit 20s` |
| `.lueur-nuit` | `globals.css:67-70` | halo radial `respire-lueur 11s` |
| `.entree-douce` | `globals.css:72-74` | `monte-doux 0.7s` |

### 1.5 Motion

| Keyframe | Définition | Consommateur |
|---|---|---|
| `derive-nuit` | `globals.css:78-81` | `.fond-nuit-anime:64` |
| `respire-lueur` | `globals.css:82-85` | `.lueur-nuit:69` |
| `monte-doux` | `globals.css:86-89` | `.entree-douce:73` |
| `skeleton-pulse` | `globals.css:92-95` | `components/ui/skeleton.tsx` |
| `kpi-enter` | `globals.css:98-107` | utility `:132-135` |
| `circular-progress` | `globals.css:110-117` | `components/espace/CircularProgress.tsx` |
| `accordion-down/up` | `tailwind.config.ts:34-38` | `components/offre/OffreAccordion.tsx` |

Garde `prefers-reduced-motion` : `globals.css:120-130` — couvre **seulement**
`kpi-enter` et `circular-progress`. `derive-nuit`, `respire-lueur`, `monte-doux`
restent animés.

### 1.6 Tokens absents (constat, pas supposition)

`tailwind.config.ts` n'expose que `colors`, `borderRadius`, `fontFamily`,
`keyframes`, `animation` (`:9-39`) ; `globals.css` ne déclare aucun `--shadow-*`,
`--space-*`, `--text-*`. Conséquences mesurées :

- **aucune échelle d'espacement** → `p-4/p-6/p-8`, `mt-1/mt-2/mt-3` au cas par cas ;
- **aucune ombre tokenisée** → `shadow-[0_1px_3px_rgba(10,10,10,0.04)]`,
  **36 lignes / 38 occurrences** (`components/offres/carte-offre.tsx:38` en porte 2,
  `app/offres/[id]/page.tsx:149`, `components/espace/form-prefs.tsx:110`, `:232`, `:271`, `:300`) ;
- **aucune échelle typographique** → `text-[11px]` (`carte-offre.tsx:85`, `:94`),
  `text-3xl` (`app/offres/page.tsx:300`).

### 1.7 Thème sombre

`darkMode: ["class"]` (`tailwind.config.ts:5`) + bloc `.dark` complet
(`globals.css:35-45`) mais **aucun basculeur** : 0 occurrence de `className="dark"`
dans `app/**` et `components/**`, pour 9 variantes `dark:` résiduelles. Déclaré, inerte.

---

## 2. Composants et états

✅ présent · ⚠️ partiel · ✗ absent

### 2.1 Chrome

| Composant | Fichier:ligne | États |
|---|---|---|
| `Chrome` | `components/chrome/chrome.tsx:8` | utilisé par offres, fiche, connexion, inscription, conseils, contact, pages légales |
| `Header` | `components/chrome/header.tsx:16` | nav active `:26-36` ✅ · sticky `:19` |
| `Footer` | `components/chrome/footer.tsx:33` | statique |
| `MobileMenu` | `components/chrome/mobile-menu.tsx:19` | null sans session |
| `NotificationsCloche` | `notifications-cloche.tsx:96` | null sans session `:191` ✅ · vide `:238-241` ✅ · non-lues `:214-221` ✅ · rollback optimiste `:184-187` ✅ |
| `AdminShell` | `components/admin/layout.tsx:31` | statique (Flowbite) |

### 2.2 Catalogue (parcours prioritaire)

| Composant | Fichier:ligne | États |
|---|---|---|
| `CarteOffre` | `components/offres/carte-offre.tsx:26` | expirée atténuée `:39` · pastille 3 branches `:64-70` · badge type neutre `:84-90` · hover/focus `:38` ✅ |
| `BarreFiltres` | `barre-filtres.tsx:50` | contrôlé, `nbResultats/nbTotal` `:327-328` ✅ |
| `PaginationOffres` | `pagination-offres.tsx:24` | ellipses `:11` ✅ |
| `BadgeEcheance` | `badge-echeance.tsx:13` | null si date illisible `:14` ✅ · 4 branches `:16-38` ✅ |
| `BlocDescription` | `bloc-description.tsx:7` | blocs via `formaterDescription` (`offre-detail-modal.tsx:211`) |
| `BlocFinancement` | `financement.tsx:20` | libellé honnête `:14-17` ✅ |
| `CtaCandidater` | `cta-candidater.tsx:15` | canal WhatsApp/mail `:7` |
| `DossierPieces` | `dossier-pieces.tsx:103` | chargement `:224-226` ✅ · refus expliqué `:78-92` ✅ |
| `SuiviCandidature` | `suivi-candidature.tsx:69` | 4 états `:17` ✅ |
| `OffreDetailModal` | `offre-detail-modal.tsx:338` | ✕/clic/Échap `:339-343` ✅ · compte à rebours `:422-434` ✅ · overlay **noir** `:363` ⚠️ |

### 2.3 Landing

| Composant | Fichier:ligne | États |
|---|---|---|
| `HeroSearch` | `landing/hero-search.tsx:13` | statique |
| `Compteurs` | `landing/compteurs.tsx:124` | `return null` si API échoue `:96-98`, `:126` ⚠️ aucun repli visuel |
| `Organisations` | `compteurs.tsx:159` | `null` si vide `:161` ⚠️ |
| `TypesBourses` | `types-bourses.tsx:79` | `null` si échec `:48-57` ⚠️ |
| `TrustBadges` | `trust-badges.tsx:60` | statique |

### 2.4 Espace client

| Composant | Fichier:ligne | États |
|---|---|---|
| `CarteProfil` | `espace/carte-profil.tsx:33` | statique |
| `FormPrefs` | `form-prefs.tsx:28` | succès `:218` / erreur `:223` en `green-800`/`red-700` ⚠️ hors tokens |
| `CoffreDocuments` | `coffre-documents.tsx:104` | chargement `:416-423` ✅ · vide `:429-432` ✅ · erreur `:401-403` ✅ |
| `KpiCard` | `espace/KpiCard.tsx:33` | **orphelin** |
| `CircularProgress` | `espace/CircularProgress.tsx:32` | **orphelin** |
| `Sparkline` | `espace/Sparkline.tsx:68` | **orphelin** |
| `PostesBarres` | `espace/PostesBarres.tsx:24` | **orphelin** |
| `SkeletonEspace` | `espace/SkeletonEspace.tsx:19` | **orphelin** (aucun import, pas même un test) |

### 2.5 États vides et primitives

| Composant | Fichier:ligne | Constat |
|---|---|---|
| `EmptyGuidant` | `empty/EmptyGuidant.tsx:24` | **orphelin** : 0 import hors fichier |
| `SvgIllustration` | `empty/SvgIllustration.tsx:22` | utilisé seulement par `EmptyGuidant` |
| `Button` | `ui/button.tsx:6-22` | 6 variantes ; `default` = `bg-primary` `:11` |
| `Skeleton*` | `ui/skeleton.tsx:12`, `:49`, `:59` | `Skeleton`/`SkeletonText` consommés (`app/inscription/page.tsx:185-187`) ; `SkeletonCard` jamais importé hors test |
| `PinStrengthBar` | `ui/pin-strength-bar.tsx:35` | états `amber/emerald` ✅ |

### 2.6 Cartes « legacy » (hors circuit)

`components/offre/OffreCard.tsx:28`, `OffreAccordion.tsx:34`, `OffreTabs.tsx:38` —
aucun import depuis `app/**` ; `OffreAccordion` importe `OffreCard`
(`OffreAccordion.tsx:3`), rien n'importe `OffreAccordion` ni `OffreTabs`.

### 2.7 Admin

| Composant | Fichier:ligne | États |
|---|---|---|
| `OffreForm` | `admin/offre-form.tsx:108` | référentiels locaux `:16-36` ⚠️ |
| `/admin` | `app/admin/page.tsx` | « Chargement… » `:151` ⚠️ texte, pas de skeleton ; palette `gray/blue` `:57-62`, `:139-216` |
| `/admin/offres` | `app/admin/offres/page.tsx` | erreur explicite `:41`, `:134-141` ✅ |
| `/admin/profils` | `app/admin/profils/page.tsx` | chargement `:60-62`, vide `:47` ; **aucun `.catch`** `:31-37` → échec réseau = spinner permanent ⚠️⚠️ |

### 2.8 États de route Next — absents

Aucun `loading.tsx`, `error.tsx`, `not-found.tsx` dans `app/**`. Les états sont
réimplémentés à la main, écran par écran.

---

## 3. Routes

### 3.1 Publiques

| Route | Fichier | États couverts |
|---|---|---|
| `/` | `app/page.tsx:73` | statique, hero `fond-nuit-anime` `:79` |
| `/offres` | `app/offres/page.tsx:93` | chargement `:72-82`, `:273-275` ✅ · erreur + retry `:277-292` ✅ · vide 2 messages `:331-354` ✅ · `aria-busy` `:359` ✅ · **états précoces avant `<Chrome>`** ⚠️ |
| `/offres/[id]` | `app/offres/[id]/page.tsx:33` | machine `chargement/charge/erreur/introuvable` `:77-126` ✅ · **hors `<Chrome>`** ⚠️ |
| `/connexion` | `app/connexion/page.tsx` | `loading` `:24`, `erreur` `:25`, `introuvable` `:27` ✅ |
| `/inscription` | `app/inscription/page.tsx` | `loading` `:33`, `error` `:34`, `pinError` `:35`, skeleton `:185-187` ✅ |
| `/inscription/confirmation` | `…/confirmation/page.tsx` | alerte test `:10`, `:58-59` ✅ |
| `/conseils` | `app/conseils/page.tsx` | statique |
| `/contact` | `app/contact/page.tsx` | statique, `text-gray-600` ⚠️ |
| `/conditions` `/confidentialite` `/mentions` | pages dédiées | statique, `text-gray-600` ⚠️ |
| `/admin-login` | `app/admin-login/page.tsx` | `error` `:13`, `loading` `:14`, `primary-700` `:93` ⚠️ |

### 3.2 Protégées (session client)

`/profil/[telephone]` (886 l.), `/edit` (342 l.), `/parametres` (439 l.),
`/documents` (47 l.) — gardées par `middleware.ts:87-95` (redirection
`/connexion`), matcher `:110-118`. **Aucun header/footer** : coquille applicative
propre (`app/profil/[telephone]/page.tsx:490`).

États solides : alerte auto-effacée `:137-149`, toast « Pas intéressé » +
annulation `:348-378`, `aria-live="polite"` `:608`, rollback favori `:361-367`.

### 3.3 Admin

`/admin`, `/admin/offres`, `/admin/profils`, `/admin/statistiques`,
`/admin/parametres` — gardées par présence du cookie `lawol_admin`
(`app/admin/layout.tsx:5-17` ; la sécurité réelle est côté API).

---

## 4. Écarts

### Famille A — Doublons et sources de vérité multiples

| # | Écart | Preuves |
|---|---|---|
| A1 | **Deux parseurs de date identiques** | `components/offres/date-limite.ts:1-44` vs `offre-detail-modal.tsx:59-82` |
| A2 | **Trois rendus du badge d'échéance**, « Clôturée » change de couleur selon l'écran | carte `bg-muted` (`carte-offre.tsx:66`) · composant `red-50/red-700` (`badge-echeance.tsx:18`) · modale `red-200/red-50/red-700` (`offre-detail-modal.tsx:424`) |
| A3 | **Référentiels dupliqués** (filières, villes, niveaux) | source `components/offres/types.ts:40`, `:79`, `:124`, `:142` ; copies `app/profil/[telephone]/edit/page.tsx:10-32`, `components/admin/offre-form.tsx:16-36`, `app/inscription/page.tsx:15`, `app/profil/[telephone]/parametres/page.tsx:11` |
| A4 | **`TYPES_OFFRES` en deux formats** | `offre-detail-modal.tsx:36-42` (Record) vs `edit/page.tsx:34-40` (tableau) |
| A5 | **Deux libellés de financement** | `labelFinancement` (`types.ts:167`) vs `labelFinancementHonteux` (`financement.tsx:14`) |
| A6 | **Deux systèmes de cartes d'offre** | actif `components/offres/carte-offre.tsx:26` ; inerte `components/offre/OffreCard.tsx:28`, `OffreAccordion.tsx:34`, `OffreTabs.tsx:38` |
| A7 | **Palette d'états jamais branchée** | `EmptyGuidant`, `SkeletonEspace`, `KpiCard`, `CircularProgress`, `Sparkline`, `PostesBarres` : 0 import depuis `app/**` |

### Famille B — États manquants ou incohérents

| # | Écart | Preuves |
|---|---|---|
| B1 | **Aucun état de route Next** (`loading`, `error`, `not-found`) | inventaire `app/**` |
| B2 | **Le chrome disparaît pendant chargement/erreur/404** | `app/offres/page.tsx:273-292` puis `<Chrome>` `:295` ; `app/offres/[id]/page.tsx:77-126` |
| B3 | **`/admin/profils` sans `.catch`** → spinner permanent | `app/admin/profils/page.tsx:31-37` |
| B4 | **4 spinners ad hoc** (aucun composant `Spinner`) | `app/offres/page.tsx:77`, `app/offres/[id]/page.tsx:82`, `app/profil/[telephone]/page.tsx:462`, `coffre-documents.tsx:421` |
| B5 | **Sections qui s'évaporent sans repli** | `landing/compteurs.tsx:126`, `:161` ; `landing/types-bourses.tsx:48-57` |
| B6 | **Classes mortes** : animation/couleur inexistantes dans le thème | `animate-slide-in` (`app/profil/[telephone]/page.tsx:606`), `text-surlignage-deep` (`:694`) |
| B7 | **`SkeletonCard` jamais utilisé** alors que les listes affichent « Chargement… » | `ui/skeleton.tsx:59` vs `app/admin/page.tsx:151` |

### Famille C — Jetons et « zéro noir »

| # | Écart | Preuves |
|---|---|---|
| C1 | **Noir résiduel explicite** | `bg-black/50` (`offre-detail-modal.tsx:363`), `#0A0A0A` (`app/layout.tsx:18`), `bg-gray-900/50` (`components/admin/layout.tsx:87`) |
| C2 | **Ombres en dur non tokenisées** — 38 occurrences / 36 lignes | `carte-offre.tsx:38`, `app/offres/[id]/page.tsx:149`, `form-prefs.tsx:110`, `:232`, `:271`, `:300`, `parametres/page.tsx:178`, `:215`, `:230`, `:264`, `:373`, `:412`, `:441` |
| C3 | **Palettes brutes hors tokens** (admin, login, pages légales) | `admin/layout.tsx:49-133`, `app/admin/page.tsx:57-62`, `:139-216`, `admin-login/page.tsx:85`, `:93`, `text-gray-600` sur `conditions`/`confidentialite`/`mentions`/`contact` |
| C4 | **Succès/erreur en vert/rouge bruts** | `form-prefs.tsx:218`, `:223` ; `app/profil/[telephone]/page.tsx:594-595` ; `badge-echeance.tsx:18` |
| C5 | **Thème sombre à moitié câblé** | `tailwind.config.ts:5`, `globals.css:35-45`, 0 basculeur, 9 variantes `dark:` orphelines |
| C6 | **`prefers-reduced-motion` incomplet** | garde `globals.css:120-130` vs `:64`, `:69`, `:73` non couverts |
| C7 | **Deux noms pour une couleur** (`primary` ≡ `signature`) | `globals.css:22` vs `:32` ; `ui/button.tsx:11` vs `bg-signature` |

### À créditer (états réellement solides)

- Catalogue : 3 états distincts + `aria-busy` + 2 messages de vide différenciés
  avec « Réinitialiser » — `app/offres/page.tsx:72-82`, `:277-292`, `:331-354`, `:359`.
- Fiche : machine à 4 états explicite — `app/offres/[id]/page.tsx:33`, `:77-126`.
- Inscription : skeleton de montage au lieu d'un flash — `app/inscription/page.tsx:185-187`.
- Messages honnêtes (aucune promesse d'envoi) — `dossier-pieces.tsx:78-92`.
- Rollback optimiste systématique — `notifications-cloche.tsx:184-187`, `app/profil/[telephone]/page.tsx:361-367`.
- Coffre documents : erreur / chargement / vide couverts — `coffre-documents.tsx:401-436`.

---

## 5. Synthèse opérationnelle

1. Tokens **couleur** clairs et respectés sur le public ; tokens **espace/ombre/typo**
   inexistants → 38 ombres en dur, tailles arbitraires.
2. Le **catalogue** est le parcours le mieux état-encodé : c'est le modèle à généraliser.
3. Les écarts les plus coûteux sont des **doublons de source de vérité** (A1-A4) :
   3 rendus pour une pastille, 2 parseurs pour une date.
4. Deux familles de composants sont **mortes** (cartes `offre/*`, panneau `espace/Kpi*`)
   et la bibliothèque d'états vides/skeletons existe mais n'est **pas branchée**.
5. « Zéro noir » n'est pas encore vrai (C1) et l'admin vit sur `gray-*` Flowbite (C3).
