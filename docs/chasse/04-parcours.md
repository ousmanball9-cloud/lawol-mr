# Chasse 4 — Parcours & confiance (Chevening, Türkiye Bursları, Stipendium Hungaricum)

> **Réalisée par le régisseur** (les agents `general` étaient en échec quota).
> Mesures DOM 29/10/2026, Chromium/Playwright 1.64.1, mobile **390×844** (`isMobile`,
> `hasTouch`), pages publiques uniquement, aucun asset ni texte recopié.
> Scripts rejouables : `%TEMP%\opencode\chasse1\mesure-parcours.mjs` et `mesure-parcours2.mjs`.
> **Limite** : 4 pages mesurées, pas les parcours complets (le dépôt de dossier exige un
> compte sur les trois sites — non contourné, conformément au garde-fou de la campagne).

| ID | Site | Écran/URL | Constat | Catégorie | Preuve (29/10/2026) | I | E |
|---|---|---|---|---|---|---|---|
| P-CV-01 | Chevening | `/scholarships/who-can-apply/` | L'éligibilité est une **liste de 17 critères** sur une page dédiée, atteignable depuis le menu (« Who can apply? ») — le critère d'entrée n'est pas noyé dans la fiche de la bourse. | confiance | 17 `<li>` visibles, 6 occurrences de « eligib », h2 « Eligibility » | 5 | 2 |
| P-CV-02 | Chevening | idem | **Aucun champ de formulaire avant y = 3 592 px** : la page instruit avant d'agir, et le seul appel à l'action arrive après 5 écrans de lecture. | parcours | `premierChampY = 3592`, hauteur page 5 255 px | 3 | 1 |
| P-CV-03 | Chevening | `/scholarships/application-timeline/` | Le calendrier est daté **et** hiérarchisé par étape de sélection (« Applications open » → « sifted against eligibility » → « reading committee » → « shortlisted for interviews »), donc l'étudiant sait ce qui se passe après l'envoi. | confiance | h2 datés août 2026 → février 2027, 3 occurrences de « deadline » | 5 | 2 |
| P-CV-04 | Chevening | `/scholarships/application-timeline/` | La date limite **n'est pas donnée globalement** : « Please refer to your country page for the deadline » → une même bourse a autant d'échéances que de pays. | parcours | extrait mesuré : « OCTOBER 2026 APPLICATIONS CLOSE / Please refer to your country page » | 4 | 1 |
| P-TR-01 | Türkiye Bursları | `/applysteps` | Le parcours est annoncé comme **« Application in 5 Steps »** dès le titre : le nombre d'étapes est connu avant de commencer. | parcours | `document.title` = « Application in 5 Steps » | 4 | 1 |
| P-TR-02 | Türkiye Bursları | idem | Deux blocs structurent la page — **« REQUIRED DOCUMENTS »** puis **« IMPORTANT DETAILS »** — avec **61 `<li>`** au total : la checklist de pièces est un objet de premier rang, pas une note de bas de page. | confiance | h2 mesurés + 61 `<li>` visibles | 5 | 2 |
| P-TR-03 | Türkiye Bursları | idem | La page ne contient **aucun champ** (`nbChamps = 0`) : consulter les étapes et candidater sont deux espaces distincts, donc rien ne se perd en route. | parcours | `nbChamps = 0`, `premierChampY = null` | 3 | 1 |
| P-TR-04 | Türkiye Bursları | accueil | Le site sépare explicitement **« Evaluation and Selection Process »** et **« Scholarship Procedures »** : le devenir du dossier a ses propres pages, indexées dans le menu. | confiance | liens mesurés `/evaluationandselectionprocess`, `/scholarshipsprocess` | 4 | 2 |
| P-SH-01 | Stipendium Hungaricum | `/apply/` | La page « Apply » est en réalité un **guide linéaire** (« This page will guide you through the application process ») dont **le premier champ est à y = 7 402 px** sur une page de 7 537 px : le formulaire est le dernier pixel de la page. | parcours | `premierChampY = 7402`, `hauteur = 7537`, 3 champs | 5 | 2 |
| P-SH-02 | Stipendium Hungaricum | idem | Les pièces à fournir sont nommées **11 fois** dans le texte (« document », « required ») et un bouton « CALL FOR APPLICATIONS – BA/BSC, MA/MSC or DOCTORAL » sépare les filières : la checklist est indexée par niveau d'études. | confiance | 11 occurrences, extrait mesuré | 4 | 2 |
| P-SH-03 | Stipendium Hungaricum | `/apply/` | Le statut du dossier est mentionné (`status|track|result`) **sans portail de suivi sur la page publique** : le suivi vit sur `apply.stipendiumhungaricum.hu`, un sous-domaine séparé. | parcours | 3 occurrences côté texte, lien sortant `apply.stipendiumhungaricum.hu` | 4 | 3 |

## Transposition LAWOL (l'étudiant ose-t-il postuler ?)

1. **La checklist est un écran, pas un paragraphe** (P-TR-02, P-SH-02) : `DossierPieces`
   existe déjà et affiche l'état de chaque pièce — il faut le porter **en tête** de fiche,
   pas après la description.
2. **L'éligibilité avant l'envie** (P-CV-01) : les critères qui éliminent (nationalité,
   niveau, âge, date limite) doivent être lisibles **sans ouvrir** un document externe.
   Aujourd'hui la fiche renvoie vers l'organisme : c'est le seul point où LAWOL est
   en retard sur les trois.
3. **Nommer les étapes et le moment** (P-CV-03, P-TR-01) : « candidature → présélection →
   entretien → résultat » avec des dates. LAWOL a `SuiviCandidature` (4 états) mais pas de
   calendrier de sélection.
4. **La date limite locale, pas globale** (P-CV-04) : quand une bourse a des échéances par
   pays, l'afficher ; sinon on fabrique de faux retardataires.
5. **Le guide avant le formulaire, mais court** (P-SH-01, P-CV-02) : 7 402 px avant le
   premier champ est un anti-modèle. Cible LAWOL : checklist visible dès le premier écran
   de la fiche, action (« Voir l'offre », « Postuler ») toujours à portée de pouce.

## Ce que LAWOL fait déjà mieux (mesuré dans le code)

- `SuiviCandidature` rend **4 états** explicites (`components/offres/suivi-candidature.tsx:17`)
  là où Stipendium renvoie vers un sous-domaine.
- `DossierPieces` explique un **refus serveur sans promettre un envoi**
  (`dossier-pieces.tsx:78-92`) — aucun des trois ne dit ce qui se passe en cas d'échec.
- `BadgeEcheance` traite J-0 et l'expiration (`badge-echeance.tsx:16-38`) ; Chevening laisse
  la date au niveau du pays, Türkiye ne l'affiche pas sur `/applysteps`.
