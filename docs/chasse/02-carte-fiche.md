# 02 — Carte d'offre & fiche : patterns concurrents (JobTeaser, Handshake)

**Objet** : extraire les patterns « carte d'offre » (liste/catalogue) et « fiche » (bourse/stage) réutilisables pour LAWOL.mr.
**Sites** : `jobteaser.com` (version FR publique) et `joinhandshake.com` + `app.joinhandshake.com/public/...` (pages publiques, sans compte).
**Date de relevé** : 29/10/2026.

**Méthode (rejouable)**
- Mesures DOM via Playwright 1.64.1 / Chromium, viewport **375×812**, UA iPhone, DPR 2 ; valeurs citées en px mesurés, pas en impression.
- JobTeaser affiche un overlay cookies `position:fixed` de **812 px** (écran entier) : toutes les mesures ont été prises après clic « Continuer sans accepter », sinon rien n'est lisible.
- La fiche Handshake publique est **volontairement tronquée** par le sign-in (« Full job details available after sign-in ») : c'est l'état public réel, aucun contournement d'authentification, aucun scraping derrière compte.
- Aucune capture, aucun texte ni asset recopié : seules des mesures et des libellés courts cités comme preuve.

**Échelles** — impact = gain pour « trouver et comprendre la bonne offre vite » (5 = décisif) ; effort = coût d'implémentation côté LAWOL (5 = lourd).

| ID | site | écran/URL | constat (1 phrase) | catégorie | preuve (URL + date) | impact 1-5 | effort 1-5 |
|---|---|---|---|---|---|---|---|
| C-JT-01 | JobTeaser | Liste `/fr/job-offers` | Sur un écran de 812 px, le 1er bloc offre démarre à y=544 et le 2e à y=895, donc aucune carte entière n'est visible au premier écran : l'en-tête (H1 32 px sur 2 lignes + rangée de chips + bouton « Tous les filtres » + compteur « 34 278 offres ») mange 2/3 de la hauteur. | perf | `/fr/job-offers` · 29/10/2026 | 5 | 2 |
| C-JT-02 | JobTeaser | Liste + fiche | L'échelle typographique mobile est courte et stable (32 / 24 / 20 / 18 / 16 / 14 px hors un chip à 13,3 px) et le seul bouton primaire mesure 44 px de haut, jamais moins. | token | `/fr/job-offers/12794c18-5fac-4e54-ab8d-1f2c17f7537a-dior-stage-assistant-presse-showroom-f-h` · 29/10/2026 | 3 | 1 |
| C-JT-03 | JobTeaser | Liste | La carte empile 5 zones (logo 48 px, nom employeur, titre 2 lignes, type + ville, badge) sur un pas de 290 px et **n'affiche jamais le salaire**, qui n'existe que dans la fiche. | composant | `/fr/job-offers` · 29/10/2026 | 4 | 3 |
| C-JT-04 | JobTeaser | Liste | Deux badges de nature différente cohabitent sur la carte — « Candidature simplifiée » (qualité du processus) et « Offre de la semaine » (mise en avant commerciale) — surmontés d'un âge relatif « il y a 34 minutes ». | confiance | `/fr/job-offers` · 29/10/2026 | 4 | 2 |
| C-JT-05 | JobTeaser | Liste filtrée `/fr/job-offers?contract[]=INTERNSHIP` | Le filtre passé en URL n'a aucun effet observable : 34 275 offres et les 4 mêmes premières cartes qu'avec `contract[]=INTERNSHIP,VIE`, dont un CDI en tête, tandis que la pastille « Contrat » affiche « 0 » et « Tous les filtres » affiche « 1 ». | confiance | `/fr/job-offers?contract[]=INTERNSHIP` · 29/10/2026 | 5 | 2 |
| C-JT-06 | JobTeaser | Fiche | Les 5 faits de décision (contrat, lieu, date de début, salaire, télétravail) tiennent dans le premier écran, mais les 3 critères qui éliminent réellement un candidat (date limite, niveau d'étude requis, fonction) sont rejetés après la description, à ~1 600 px du haut. | parcours | fiche Dior (URL ci-dessus) · 29/10/2026 | 5 | 2 |
| C-JT-07 | JobTeaser | Fiche | Chaque donnée absente est affichée avec un état explicite (« Information non renseignée », « Non spécifié », « Tant que l'offre est en ligne ») au lieu d'être supprimée, ce qui évite de faire croire à un champ oublié. | composant | fiche Dior (URL ci-dessus) · 29/10/2026 | 5 | 1 |
| C-JT-08 | JobTeaser | Fiche | « Postuler » n'existe qu'une seule fois, à y=376, et aucun élément `sticky`/`fixed` ne le reprend après 1 400 px de défilement sur une page de 3 031 px : sur mobile il faut remonter tout en haut pour candidater. | mobile | fiche Dior (URL ci-dessus) · 29/10/2026 | 4 | 1 |
| C-HS-01 | Handshake | Fiche publique `/public/jobs/11807432` | Le bloc « At a glance » livre 6 faits en 6 lignes avant toute prose : « $15–20/hr » ; « Hybrid, based in Long Beach, CA, or Orange, CA » ; la glose du mot technique (« Work in person for part of the week, from one of the locations ») ; « Internship » ; « Part-time ∙ From November 30, 2026 to February 28, 2027 » ; « US work authorization not required ». | composant | `/public/jobs/11807432` · 29/10/2026 | 5 | 3 |
| C-HS-02 | Handshake | Fiche | Une seule ligne de 14 px donne la fraîcheur **et** l'échéance : « Posted 1 day ago ∙ Apply by November 28, 2026 at 8:59 AM ». | confiance | `/public/jobs/11807432` · 29/10/2026 | 4 | 1 |
| C-HS-03 | Handshake | Fiche | La fiche publique s'arrête volontairement à mi-description sur un mur explicite (« Full job details available after sign-in ») et « Apply » renvoie vers `/access` : tout le contenu de décision reste public, seul le détail et l'action exigent un compte (corps de page public = 1 128 caractères). | parcours | `/public/jobs/11807432` · 29/10/2026 | 3 | 1 |
| C-HS-04 | Handshake | Fiche | Un bloc « Similar Jobs » clôt la fiche avec des mini-cartes dont la méta tient sur une ligne (« $15–20/hr ∙ Internship ∙ Nov 30–Feb 28 »), le lieu et l'âge sur la suivante. | parcours | `/public/jobs/11807432` · 29/10/2026 | 4 | 3 |
| C-HS-05 | Handshake | Liste facette `/internships/role/finance/` | La carte fait 202 px en 3 zones (logo + employeur 14 px, titre 24 px, méta 14 px) et affiche le **salaire dans la liste** (« $30+/hr », « $15+/hr ») : le critère n°1 de l'étudiant est visible sans ouvrir la fiche. | mobile | `/internships/role/finance/` · 29/10/2026 | 5 | 3 |
| C-HS-06 | Handshake | `/students/whos-hiring/` | Le premier écran de la page d'entrée ne contient **aucune offre** : la 1re carte est à y=1 010, sous un H1 de 90 px et un carrousel de requêtes. | perf | `/students/whos-hiring/` · 29/10/2026 | 4 | 2 |
| C-HS-07 | Handshake | `/students/whos-hiring/` + facettes | Pas de moteur de recherche public : la découverte passe par des pastilles de requêtes suggérées (« Entry-level AI training jobs using Python », Full-time, Remote, Internship) puis par des pages facettes pré-calculées avec compteurs en direct (Finance 636, Computer Science 574, Remote 436, New York 712). | parcours | `/students/whos-hiring/` · 29/10/2026 | 4 | 3 |
| C-HS-08 | Handshake | Fiche + facette | Aucun CTA collant sur mobile non plus : « Apply » n'apparaît qu'à y=316 d'une fiche de 2 394 px, et le retour en haut est le seul moyen de re-candidater après lecture. | mobile | `/public/jobs/11807432` · 29/10/2026 | 3 | 1 |

**Correctifs à ne surtout pas copier** : hiérarchie de titres inversée sur les facettes Handshake (H2 « FIND YOUR NEXT JOB » 96 px avant le H1 « Finance internships » 32 px) ; en-tête de 544 px avant la première carte (JobTeaser) ; double badge de confiance (C-JT-04) ; lien de filtre partageable qui ne filtre pas (C-JT-05).

## Transposition LAWOL

1. **Carte** ≤ 210 px, 3 zones + une méta de 14 px « montant de la bourse ou du stage ∙ type ∙ âge relatif », le montant toujours visible dès la liste (C-HS-05, C-JT-03) — jamais la méta à la place du montant.
2. **Fiche** : bloc « L'essentiel » de 5–6 lignes avant toute prose — montant, lieu/langue d'enseignement, dates exactes (« du 30/11/2026 au 28/02/2027 », pas « 6 mois »), niveau requis, éligibilité Mauritanie — avec glose en clair de chaque terme technique (C-HS-01).
3. **Critères qui éliminent** (niveau d'étude, nationalité/éligibilité, date limite) remontés **avant** la description, et « non communiqué » affiché explicitement plutôt que masqué (C-JT-06, C-JT-07, C-HS-02).
4. **Un seul CTA collant** en bas de fiche sur mobile (« Postuler » / « Voir l'offre ») : les deux concurrents n'en ont aucun (C-JT-08, C-HS-08), c'est un gain immédiat et peu coûteux.
5. **Trouver** : navigation par facettes avec compteurs (domaine, pays, niveau, bourse/stage) plutôt qu'un moteur vide, premier écran qui montre au moins 2 cartes entières (C-HS-07, C-JT-01, C-HS-06), et un seul badge de confiance par carte (C-JT-04).

## Contrôle du régisseur (29/10, re-mesuré dans le code LAWOL)

- **Carte sans financement : CONFIRMÉ.** `components/offres/carte-offre.tsx:42-99`
  affiche employeur, titre, pays, date limite, aperçu 2 lignes, échéance, badge
  type, badge catégorie — **aucun financement**. La transposition n°1 est un vrai trou.
- **Aucun CTA collant : CONFIRMÉ.** `0` occurrence de `sticky`/`fixed inset-x` dans
  `app/offres/[id]/page.tsx`, `components/offres/*`, `offre-detail-modal.tsx`.
- **Réserve de faisabilité (important pour l'effort)** : `Offre.type_financement`
  existe déjà dans le payload de liste (`components/offres/types.ts:9`), donc
  exposer le **type** de financement en carte coûte peu (effort ~1). En revanche
  **aucun champ « montant »** n'existe : afficher « 12 000 MRU » ou « 100 % » exige
  une extraction + colonne/metadata, effort réel ~4, pas 1. À arbitrer en synthèse :
  commencer par le type, pas par le montant.

## URLs vérifiées (absolues)

- `https://www.jobteaser.com/fr/job-offers`
- `https://www.jobteaser.com/fr/job-offers?contract%5B%5D=INTERNSHIP`
- `https://www.jobteaser.com/fr/job-offers/12794c18-5fac-4e54-ab8d-1f2c17f7537a-dior-stage-assistant-presse-showroom-f-h`
- `https://app.joinhandshake.com/public/jobs/11807432`
- `https://joinhandshake.com/students/whos-hiring/`
- `https://joinhandshake.com/internships/role/finance/`
- `https://joinhandshake.com/internships/remote/`
