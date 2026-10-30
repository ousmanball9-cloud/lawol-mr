# Chasse 3 — Recherche, filtres, navigation

> Trois sites, 23 constats, maximum 8 par site. Chaque ligne est rejouable : URL + date
> de capture. Mesures au 29/10/2026, Chromium 390×844 (`isMobile`, UA iPhone) et
> 1280×900, `document.body.innerText` + `getBoundingClientRect` — pas d'impression
> visuelle. Amont obligatoire : `00-etat-des-lieux.md` §2.2 (catalogue) et §4 (écarts).
> Aucune page derrière authentification, aucun asset ni texte reproduit.

**Découverte à signaler avant le tableau** : `scholarshipportal.eu` n'existe plus comme
moteur autonome. `GET https://www.scholarshipportal.eu/` répond **301 →**
`https://www.mastersportal.com/scholarships/`. Les constats `SP-*` sont donc mesurés sur
la cible réelle (mastersportal.com, réseau Studyportals). Toute URL de veille qui cite
`scholarshipportal.eu` doit être réécrite.

**Limite de mesure** : sur mastersportal, le rendu 1280 px a été bloqué par Cloudflare
dans cette session (« Attention Required! | Cloudflare », 2 tentatives). Les constats
`SP-*` portent donc sur le **mobile 390 px** et sur le HTML rendu, jamais sur une
extrapolation desktop.

---

## 1. Constats

### scholarshipportal.eu → mastersportal.com (7)

| ID | site | écran/URL | constat (1 phrase) | catégorie | preuve (URL + date 29/10/2026) | impact 1-5 | effort 1-5 |
|---|---|---|---|---|---|---|---|
| SP-01 | scholarshipportal.eu | racine du domaine | Le domaine ne sert plus aucun moteur propre : il redirige en 301 vers `mastersportal.com/scholarships`, donc toute référence externe pointe en réalité un autre produit. | IA | `https://www.scholarshipportal.eu/` → `HTTP/1.1 301` + `Location: https://www.mastersportal.com/scholarships/` (29/10/2026) | 2 | 1 |
| SP-02 | mastersportal | `/scholarships` | L'entrée du moteur tient en trois contrôles — « Where will you study? » (229 entrées, Mauritanie présente), le niveau (3 valeurs) et un champ nommé « Search by Study & Country » — donc le champ texte annonce ce qu'il cherche au lieu d'un « Rechercher » muet. | IA | `https://www.mastersportal.com/scholarships/` à 390 px : `select` 229 options + `select` 3 options + `input[placeholder="Search by Study & Country"]` (29/10/2026) | 3 | 2 |
| SP-03 | mastersportal | `/search/scholarships/master` | Le contexte de recherche est affiché en tête de liste sous la forme « Page 1 · 5778 Scholarships », donc l'étudiant sait toujours combien il reste et où il en est. | IA | `https://www.mastersportal.com/search/scholarships/master` : texte mesuré `Page 1 \| 5778 Scholarships` (29/10/2026) | 5 | 2 |
| SP-04 | mastersportal | `/search/scholarships/master` (mobile) | Sur mobile, les filtres vivent dans un bouton flottant « Filters » (`FloatingFiltersButtonMobile`) qui entre dans le viewport au défilement, au lieu d'occuper la hauteur de l'écran. | mobile | même URL, 390 px : `div.FloatingFiltersButtonMobileWrapper is-inViewport` après un scroll de 1 600 px (29/10/2026) | 5 | 3 |
| SP-05 | mastersportal | cartes de `/scholarships` et de `/search/scholarships/master` | Chaque carte porte les quatre attributs qui décident d'un clic — type de financeur (« Independent provider » / « Provided by university »), montant (« Grant 1200 EUR » / « Various benefits »), échéance (« Deadline 10 Jul 2026 ») et caractère méritocratique — sans ouvrir la fiche. | composant | `https://www.mastersportal.com/scholarships/` : `Grant 1200 EUR / Deadline 10 Jul 2026` ; `https://www.mastersportal.com/search/scholarships/master` : `Independent provider / Grant Various benefits / Deadline Not specified / Merit-based` (29/10/2026) | 4 | 2 |
| SP-06 | mastersportal | facettes d'URL (`/search/scholarships/master/germany`, `/law`) | Chaque facette possède sa propre URL courte et partageable (pays, discipline), donc un filtre se transmet par message au lieu de se rejouer à la main. | IA | `https://www.mastersportal.com/search/scholarships/master/germany` et `https://www.mastersportal.com/search/scholarships/master/law`, tous deux liés depuis le menu de `/scholarships` (29/10/2026) | 4 | 2 |
| SP-07 | mastersportal | en-tête de la liste de résultats | Le périmètre est énoncé avant les résultats (« The scholarships listed below are applicable to students of all nationalities ») et la personnalisation est annoncée comme conditionnée à un compte, pas promise. | confiance | même URL : phrase mesurée en tête de liste + « Please create an account to see personalized results » (29/10/2026) | 3 | 1 |

### daad.de — base de bourses (8)

| ID | site | écran/URL | constat (1 phrase) | catégorie | preuve (URL + date 29/10/2026) | impact 1-5 | effort 1-5 |
|---|---|---|---|---|---|---|---|
| DA-01 | daad.de | `/deutschland/stipendium/datenbank/en/21148-scholarship-database/` | Le périmètre de recherche est borné par cinq listes fermées — Country (212 entrées, Mauritanie présente), Programmes for (6), Scholarship Purpose (6), Subject (8) — plus un seul champ texte « Programme title » et une case « DAAD funding programmes only ». | IA | même URL : `select#s-land` 212 options, `#s-status` 6, `#s-vorhaben` 6, `#s-fach` 8, `input#i-stichwort`, `input#c-daadonly` (29/10/2026) | 5 | 2 |
| DA-02 | daad.de | même URL, 390 px | Sur mobile les filtres sont repliés derrière « Refine your selection + » : aucun des 5 champs n'est visible avant ouverture, alors qu'en 1 280 px la case à cocher est déjà affichée. | mobile | même URL, 390 px : `select` visibles = 0 avant clic, 4 après (+ 1 champ texte + 1 case) ; 1 280 px : 1 case visible d'emblée (29/10/2026) | 5 | 3 |
| DA-03 | daad.de | bas du panneau de filtres | Aucun filtre ne s'applique à la volée : il faut actionner « Refine your selection » (formulaire `GET`) pour voir le compteur bouger, donc chaque essai coûte un aller-retour. | parcours | même URL : `input[type=submit]#stipdb-submit value="Refine your selection »"`, `form` méthode `GET` (29/10/2026) | 2 | 1 |
| DA-04 | daad.de | contrôle de tri | Le tri n'offre qu'une valeur, « Alphabetically » : impossible de trier par échéance ou par pertinence, alors que 148 bourses sont proposées. | IA | même URL : `select#s-sort` contient exactement 1 option ; libellé « Sorting: Alphabetically » (29/10/2026) | 2 | 1 |
| DA-05 | daad.de | pied de liste de résultats | La pagination se réduit à deux flèches « ‹ › » sans numéros ni nombre de pages ; la page 2 change le contenu et l'URL mais rien n'annonce combien de pages restent. | IA | `.../21148-scholarship-database/?status=&origin=&subjectGrps=&daad=&intention=&q=&page=2&back=1` : 1er résultat passé de « Study Scholarships - Master Studies… » à « Study Visits for Academics… » (29/10/2026) | 3 | 2 |
| DA-06 | daad.de | au-dessus de la liste | Le compteur « 148 Scholarship options » reste affiché en permanence, y compris filtres fermés, donc le volume est connu avant tout réglage. | IA | même URL, 390 px : « 148 Scholarship options » présent avant ouverture du panneau de filtres (29/10/2026) | 5 | 1 |
| DA-07 | daad.de | liens de bas de page | La sélection entière s'exporte en impression ou PDF (`?type=print`), donc une short-list survit à une coupure de connexion. | perf | `.../21148-scholarship-database/?type=print` et `.../21148-scholarship-database.pdf?type=print` (29/10/2026) | 4 | 2 |
| DA-08 | daad.de | libellé « Country » du panneau | Le premier filtre n'est pas la destination mais le pays de résidence d'où l'on candidate, avec une aide contextuelle dédiée : l'éligibilité géographique est traitée comme critère de premier rang. | confiance | même URL : « „Country“ is the country in which you are living and from which you are applying » lié à `/deutschland/stipendium/hinweise/en/27334-frequently-asked-questions/` (29/10/2026) | 4 | 1 |

### campusfrance.org (8)

| ID | site | écran/URL | constat (1 phrase) | catégorie | preuve (URL + date 29/10/2026) | impact 1-5 | effort 1-5 |
|---|---|---|---|---|---|---|---|
| CF-01 | campusfrance.org | `/fr/trouver-formation-universitaire-France` | Il n'existe pas de moteur unique : l'entrée « Trouver sa formation » est un article qui renvoie vers sept catalogues séparés (licence, master, Taught in English, CampusArt, écoles d'été, doctorat, formation à distance). | IA | même URL : 7 liens sortants vers `cataloguelm…/licence`, `cataloguelm…/master`, `taughtie…`, `campusart.org`, `ecolesdete…`, `doctorat…`, `foad…` (29/10/2026) | 3 | 1 |
| CF-02 | campusfrance.org | `cataloguelm.campusfrance.org/master/#/catalog` | Le catalogue master impose un axe d'entrée exclusif — `#/keyword`, `#/domain` ou `#/region` — donc on choisit *comment* chercher avant de savoir *quoi* chercher. | IA | même URL : 3 ancres `href="#/keyword"`, `#/domain`, `#/region` ; aucun `select` ni case visible à 390 px (29/10/2026) | 4 | 2 |
| CF-03 | campusfrance.org | `campusbourses.campusfrance.org/#/catalog` | Le moteur de bourses est un sous-domaine au design distinct (CampusBourses v1.5.4) affichant « 378 programmes de bourses », un seul champ « Rechercher » et des résultats en lignes de tableau portant déjà « Date limite de candidature ». | IA | même URL : titre `CampusBourses - v1.5.4`, `378 programmes de bourses`, `input[placeholder=Rechercher]`, lignes `tr[ng-click=showProgram(prog.bourse_id)]` (29/10/2026) | 5 | 3 |
| CF-04 | campusfrance.org | même URL, 390 px | Les filtres existent (Type de bourse, Niveau d'études, Domaine d'études, Lieu, Bourses financées par + 5 zones) mais aucun n'est visible à 390 px tant que le panneau latéral n'est pas ouvert. | mobile | même URL : 10 `button.btn-filter` mesurés `visible:false` à 390 px, ouverture par `ng-click="doShowAsideAction($event);app.navbarCollapsed=-1"` (29/10/2026) | 5 | 3 |
| CF-05 | campusfrance.org | `/fr/bourses-etudiants-etrangers` | Le lien d'entrée vers le moteur de bourses est mort : l'article pointe `campusbourses.campusfrance.org/fria/bourse/#/catalog` qui répond 404, alors que la racine `#/catalog` répond 200. | confiance | `https://campusbourses.campusfrance.org/fria/bourse/#/catalog` → status 404 (« Not Found ») ; `https://campusbourses.campusfrance.org/#/catalog` → 200 (29/10/2026) | 4 | 1 |
| CF-06 | campusfrance.org | `https://www.campusfrance.org/fr` (bloc d'accueil) | Deux questions indépendantes cohabitent — « Je cherche une formation » (type) et « Ma nationalité » (financement) — sans que la première alimente la seconde : deux parcours parallèles, jamais combinés. | IA | même URL : 2 blocs distincts, formulaire de recherche `GET /fr/recherche` séparé des formulaires `POST /fr` (29/10/2026) | 4 | 3 |
| CF-07 | campusfrance.org | même bloc « Comment financer vos études ? » | La nationalité est demandée comme point d'entrée du financement (liste de pays où la Mauritanie figure), donc l'aide est cadrée par l'origine avant tout autre critère. | confiance | même URL : liste « Ma nationalité » avec « Mauritanie » présente, en regard du bloc financement (29/10/2026) | 4 | 2 |
| CF-08 | campusfrance.org | pages éditoriales vs catalogues | Le fil d'Ariane existe sur les pages éditoriales mais disparaît dès qu'on entre dans un catalogue ou dans CampusBourses, donc le retour à l'étape précédente n'est plus indiqué. | IA | `/fr/bourses-etudiants-etrangers` : « Fil d'Ariane » présent (Accueil › Étudier › Articles) ; `campusbourses…#/catalog` : aucun fil d'Ariane mesuré (29/10/2026) | 3 | 2 |

---

## 2. Transposition LAWOL (5 lignes)

1. **Panneau de filtres mobile** (SP-04, CF-04, DA-02) : sous 768 px, remplacer les 4 `select`
   empilés de `barre-filtres.tsx` par un bouton flottant « Filtres · n » ouvrant un panneau
   plein écran, avec compteur et « Réinitialiser » dans le pied du panneau ; au-delà de
   768 px, la barre actuelle ne change pas. Aucun token nouveau, réemploi de `bg-card`,
   `border-border`, `signature`.
2. **Bandeau de résultats collant** (SP-03, DA-06) : sortir `offres-compteur` de la carte et
   le placer dans une barre `sticky top-*` sous le header, avec le tri courant — même
   `role="status"` existant, zéro nouveau composant.
3. **Facettes dans l'URL** (SP-06) : aujourd'hui seul `?recherche=` est poussé ; faire porter
   `pays`, `filiere`, `financement`, `categorie`, `tri` par l'URL pour qu'un filtre se
   partage par WhatsApp (canal réel du public mauritanien) et survive au retour arrière.
4. **Type de financement et financeur sur la carte** (SP-05) : remonter sur `CarteOffre`
   les deux champs déjà présents dans le payload (`type_financement`, `entreprise`) et le
   libellé de `labelFinancement` — aucune collecte nouvelle, aucune duplication de
   référentiel (contrainte A3/A5 de l'état des lieux). **Réserve mesurée par le régisseur :
   il n'existe aucun champ « montant »** (voir `02-carte-fiche.md` §Contrôle) — afficher
   « Grant 1200 EUR » exige extraction + colonne, effort ~4, à arbitrer séparément.
5. **Éligibilité par origine assumée** (DA-08, CF-07) : exposer « Je candidate depuis… » en
   premier filtre du catalogue, avec la mention que le pays d'origine conditionne
   l'éligibilité ; à traiter avec le point 6 des règles locales (enums écriture/lecture) —
   c'est un filtre, pas une nouvelle colonne.

## 3. Ce que LAWOL fait déjà mieux (3 lignes)

1. Le tri : LAWOL propose « Plus urgentes / Plus récentes » + bascule « clôture < 30 jours »
   (`barre-filtres.tsx:147-165`) ; DAAD n'offre qu'un `select` à **une** option,
   « Alphabetically » (DA-04).
2. Le retour d'information : compteur `nbResultats/nbTotal` en `role="status"`
   (`barre-filtres.tsx:177-178`) et filtres instantanés côté client, là où DAAD exige un
   `submit` « Refine your selection » avant tout résultat (DA-03).
3. La pagination : `PaginationOffres` affiche des numéros avec ellipses
   (`pagination-offres.tsx:11`) ; DAAD se limite à « ‹ › » sans total de pages (DA-05), et
   `?recherche=` est déjà poussé par le hero (`app/offres/page.tsx:86`).
