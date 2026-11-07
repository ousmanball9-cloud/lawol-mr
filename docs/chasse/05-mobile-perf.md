# Chasse 5 — Mobile & performance (mesure réelle)

> **Réalisée par le régisseur** (agents en échec quota).
> 29/10/2026, Chromium/Playwright 1.64.1, viewport **390×844** (`isMobile`, `hasTouch`),
> `waitUntil: load` + 1,2 s, LCP/CLS par `PerformanceObserver` (`buffered: true`),
> poids = `transferSize` par type de ressource.
> Script rejouable : `%TEMP%\opencode\chasse1\mesure-perf.mjs`.

## 1. Mesures

### LAWOL (3 passages — la première est à froid)

| Page | LCP | CLS | TTFB | DCL | Load | DOM | Transfert | JS | CSS | Requêtes |
|---|---|---|---|---|---|---|---|---|---|---|
| `/offres` — passage 1 (**cache froid**) | **7 652 ms** | 0 | 1 186 ms | 2 410 ms | 3 822 ms | 512 | 281 Ko | 134 Ko | 94 Ko | 21 |
| `/offres` — passage 2 | 3 844 ms | 0 | 475 ms | 946 ms | 1 178 ms | 509 | 298 Ko | 151 Ko | 94 Ko | 26 |
| `/offres` — passage 3 | 3 784 ms | 0 | 483 ms | 691 ms | 1 918 ms | 509 | 298 Ko | 151 Ko | 94 Ko | 26 |
| Accueil `/` | 1 364 ms | 0,001 | 612 ms | 995 ms | 1 570 ms | 398 | 285 Ko | 142 Ko | 94 Ko | 23 |

**Lecture honnête** : le 7,6 s est un premier passage à froid — ne pas le citer comme
la performance du site. La valeur stable est **≈ 3,8 s de LCP sur `/offres`**, soit
**2,8 × l'accueil** (1,36 s) de la même application, sur le même réseau, dans le même
navigateur. C'est la seule page mesurée aussi lente.

### Concurrents — **non comparables, mesure invalide**

| Page | LCP | DOM | Cliquables détectés | Verdict |
|---|---|---|---|---|
| JobTeaser `/fr/job-offers` | 1 591 ms | 167 | **0** | contenu rendu après la mesure (JS/mur) → LCP non représentatif |
| Handshake fiche publique | 1 335 ms | 47 | **2** | idem |

**Je ne classe donc pas LAWOL contre eux.** Le chiffre des concurrents porte sur une page
quasi vide : l'annoncer comme « LAWOL est 2,8× plus lent que Handshake » serait faux.

## 2. Défauts mesurés sur `/offres` (390 px)

| ID | Constat | Preuve | I | E |
|---|---|---|---|---|
| M-01 | **33 cibles tactiles sur 45 sont sous 44 px** (73 %) : la règle « 44 px minimum » du design system n'est pas tenue sur la page prioritaire. | `cibles_44ko = 33 / cliquables = 45` | 5 | 2 |
| M-02 | **16 textes sous 12 px** sur `/offres`, 0 sur l'accueil : les tailles ad hoc (`text-[11px]`) se concentrent exactement là où l'étudiant lit. | `textes_sous_12px = 16` vs `0` accueil | 4 | 1 |
| M-03 | **`/offres` a un LCP 2,8× supérieur à l'accueil** alors que le poids transféré est identique (~285 Ko) : la différence n'est pas le JS, c'est l'attente de données avant le premier rendu utile. | 3 784 ms vs 1 364 ms ; 298 Ko vs 285 Ko | 5 | 3 |
| M-04 | CLS = **0** et aucun débordement horizontal sur les deux pages : le layout mobile est stable — à créditer et à ne pas casser. | `cls = 0`, `debordement_h = false` | 3 | 1 |
| M-05 | Le JS pèse **151 Ko** et le CSS **94 Ko** pour 21-26 requêtes : rien d'alarmant, mais le CSS est la moitié du JS sur une app qui n'a pas de thème sombre actif (`.dark` inerte). | `js_ko/cs_ko` | 2 | 2 |

## 3. Ce qu'il faut faire — et ce qu'il ne faut pas conclure

1. **Ne pas optimiser avant de savoir** : M-03 dit « l'attente de données pèse », pas
   « l'API est lente ». Instrumenter d'abord (`performance.mark` avant/après le fetch du
   catalogue) et rejouer 5 passages à froid. Un chiffre lab ≠ données terrain (CrUX) :
   **aucune donnée terrain n'existe aujourd'hui** pour lawol-mr.
2. **M-01 et M-02 sont réparables sans mesure supplémentaire** : c'est le même défaut que
   la chasse 1 (bouton ≥ 44 px, échelle typo de 7 paliers). Corriger les tokens corrige
   mécaniquement une partie des 33 cibles.
3. **Ne pas toucher au CLS** : il est à 0. Toute animation ajoutée doit garder cette
   propriété (`verify:design` largeur 8/8 + CLS 0).
4. **Test de sortie** : `/offres` en 3G simulée (`Network.emulateNetworkConditions`,
   1,6 Mbit/s, RTT 150 ms) doit rendre au moins **2 cartes entières** au premier écran
   et garder le header visible pendant le chargement (lien avec `0`·B2).

## 4. Limites déclarées

- Mesure **labo**, un seul réseau, un seul appareil émulé : pas de données terrain.
- Les deux concurrents n'ont pas pu être mesurés valablement (contenu post-chargement)
  → aucune comparaison de performance n'est affirmée dans ce document.
- Aucune mesure d'INP/TBT : non instrumentée ici, donc non annoncée.
