# Chasse 1 — Tokens & langage visuel (Stripe, Linear, Airbnb)

> **Réalisée par le régisseur** (l'agent `general` a échoué sur quota gratuit).
> Mesure DOM au 29/10/2026, Chromium via Playwright 1.64.1, viewport **1280×900**,
> `getComputedStyle` sur tous les éléments visibles, 3 positions de scroll.
> Script rejouable : `%TEMP%\opencode\chasse1\mesure-tokens.mjs`.
> **Limite assumée** : desktop seulement ; les pas de section sont sous-comptés sur
> les pages dynamiques (peu de `<section>` visibles).

## 1. Mesures brutes

| Site | Tailles de police (px × occurrences) | Rayons | Ombres distinctes | Hauteurs de bouton | Pas de section |
|---|---|---|---|---|---|
| Stripe | 16 (199) · 11 (64) · 22 (20) · 26 (16) · 14 (15) · 32 (11) · 18 (7) · 12 (6) | **4px (41)** · 6px (1) | **0** | 48 (19) · 40 (7) · 34/38 (4) | 128 · 192 |
| Linear | 13 (214) · 12 (170) · 14 (128) · 15 (59) · 16 (49) · 10 (23) · 64 (5) · 24 (4) | 9999 (76) · 8px (21) · 4px (19) · 2px (7) | 6 (dont 4 = **anneau 1px inset**) | 29 (18) · 28 (12) · 40 (3) · 44 (2) | 256 |
| Airbnb | 14 (199) · 28 · 22 · 21 | 4px (29) · 8px (9) · 12px (2) | 1 (anneau de focus) | 40 (3) · 58 | — |

## 2. Ce que ces trois sites démontrent

| ID | Constat | Preuve | Impact | Effort |
|---|---|---|---|---|
| T-01 | **La profondeur ne vient pas des ombres** : Stripe n'en a **aucune** (0 distincte au DOM), Linear n'a que des **anneaux 1px inset**, Airbnb une seule (focus). Le modèle dominant = **bordure/anneau 1px**, pas `box-shadow` floutée. | Stripe `nbOmbres=0` ; Linear `rgba(0,0,0) 0 0 0 1px` ×5 | 5 | 1 |
| T-02 | **Un seul rayon dominant** : Stripe 4px sur 41 éléments, Airbnb 4px sur 29 + 8px sur 9. Le 9999px de Linear est réservé aux pastilles/avatars, jamais aux cartes. | `rayons` ci-dessus | 4 | 1 |
| T-03 | **Échelle typo courte** : 6 à 8 tailles pour tout un site. Stripe : 11/12/14/16/18/22/26/32. Linear : 10/12/13/14/15/16/24/64. Jamais de `text-[11px]` ad hoc hors de cette échelle. | `tailles` ci-dessus | 5 | 2 |
| T-04 | **Bouton primaire ≥ 44–48 px** : Stripe 48 (19 boutons), Linear 44 pour les CTA réels (ses 28–29 px sont la navigation dense desktop). Le 48 px est le standard « touch » tenable. | `hauteurBoutons` | 4 | 1 |
| T-05 | **Pas de section très large** : 128 / 192 / 256 px de padding vertical cumulé, en 3–4 paliers seulement, jamais une valeur arbitraire. | `pasSections` | 3 | 1 |

## 3. Proposition d'échelle LAWOL (prête à coller)

Contrainte : compatible « zéro noir » → **aucune ombre en `rgba(0,0,0,…)`**, la teinte
d'ombre est l'indigo de la charte.

```ts
// tailwind.config.ts — theme.extend
spacing: { 1: '4px', 2: '8px', 3: '12px', 4: '16px', 6: '24px', 8: '32px',
           12: '48px', 16: '64px', 24: '96px' },       // 9 paliers, fin des valeurs arbitraires
boxShadow: {
  // niveau 1 : carte au repos — hairline + voile indigo très faible
  card:      '0 1px 2px rgba(30, 27, 75, 0.06), 0 0 0 1px rgba(30, 27, 75, 0.06)',
  // niveau 2 : survol / élément soulevé
  lift:      '0 2px 6px rgba(30, 27, 75, 0.10), 0 0 0 1px rgba(37, 99, 235, 0.35)',
  // niveau 3 : panneau, modale, popover
  panel:     '0 12px 32px rgba(30, 27, 75, 0.16), 0 0 0 1px rgba(30, 27, 75, 0.08)',
},
fontSize: {   // 7 paliers + hero fluide
  '2xs': ['11px', { lineHeight: '16px', letterSpacing: '0.08em' }],
  xs:    ['12px', { lineHeight: '18px' }],
  sm:    ['14px', { lineHeight: '20px' }],
  base:  ['16px', { lineHeight: '24px' }],
  lg:    ['18px', { lineHeight: '26px' }],
  xl:    ['22px', { lineHeight: '30px' }],
  '2xl': ['26px', { lineHeight: '34px' }],
  '3xl': ['32px', { lineHeight: '40px' }],
}
```

**Remplacement mécanique prévu** : les **38 occurrences** de
`shadow-[0_1px_3px_rgba(10,10,10,0.04)]` (36 lignes, cf. `00-etat-des-lieux.md` C2)
deviennent `shadow-card` — même rendu perçu, **zéro noir**, une seule source.
`hover:shadow-[…0.06]` devient `hover:shadow-lift`.

**Garde-fou** : `verify:design` doit rester vert après substitution, et l'assertion
« zéro noir » (`grep -E "bg-ink|#0A0A0A|0 0% 4%"`) doit passer **de 3 violations
connues à 0** (`offre-detail-modal.tsx:363`, `app/layout.tsx:18`,
`components/admin/layout.tsx:87`).

## 4. Ce que la chasse 1 ne tranche pas

- **Rayon de carte** : 4px (Stripe/Airbnb) ou 8px (Linear) ? LAWOL utilise aujourd'hui
  `rounded-lg` = `--radius` 0.5rem = **8px**. Recommandation : garder 8px (déjà partout,
  coût de migration nul), 4px ne se justifie pas assez pour payer 38 fichiers.
- **Thème sombre** (C5 de l'état des lieux) : le bloc `.dark` existe sans basculeur.
  Le supprimer ou le câbler est une décision produit, pas un token — hors périmètre ici.
