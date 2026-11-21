"""Mesure l'ELIGIBILITE PROUVEE du catalogue public — sans ecrire en base.

Question a laquelle ce script repond, en une commande :
    « Sur les offres reellement servies aujourd'hui, combien portent un indice
      d'origine (contrat §2.2) — et combien l'extracteur de production en
      recupererait s'il etait rejoue sur le texte stocke ? »

Pourquoi c'est necessaire (mesure du 20/11/2026) : l'API servait 313 offres non
closes et seulement 25 portaient `origine_eligible` (8 %). La promesse du
lancement (« bourses eligibles pour les Mauritaniens ») n'est donc pas prouvee
pour 92 % du catalogue. Avant de corriger quoi que ce soit, on mesure :

  · SERVIS      = offres non closes renvoyees par GET /api/v1/offres
  · STOCKES     = celles qui portent deja un indice conforme (ce que voit l'eleve)
  · RECUPERABLES= celles ou `origine_depuis_texte(titre + description)` rend un
                  indice : le travail d'ingestion manque, pas l'information
  · MUETTES     = ni stocke ni recuperable -> le texte ne dit rien (silence
                  honnete, conforme au contrat : pas de badge invente)

Le script est en LECTURE SEULE : aucun secret, aucun appel d'ecriture.

Usage :
    python scripts/mesure-origine.py                 # verdict + compteurs
    python scripts/mesure-origine.py --echantillon 5 # + 5 textes muets a inspecter
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request

API = "https://lawol-api.onrender.com/api/v1/offres"
LIMITE = 100
PAGE_MAX = 20  # garde-fou : 2000 offres, largement au-dela du catalogue


def _stdout_utf8() -> None:
    """Console Windows cp1252 : sans cela, un « é » fait tomber le verdict."""
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # pragma: no cover - environnements sans reconfigure
        pass


def charger_catalogue() -> list[dict]:
    """Toutes les offres non closes, page par page (l'API ne rend pas de total).

    La LISTE ne transporte PAS `description` (elle sert `description_apercu`) :
    mesurer l'extracteur sur la liste reviendrait a le mesurer sur des titres.
    On complete donc chaque offre par son DETAIL, seul endroit ou le texte
    integral est servi.
    """
    offres: list[dict] = []
    for page in range(PAGE_MAX):
        url = f"{API}?limit={LIMITE}&offset={page * LIMITE}"
        with urllib.request.urlopen(url, timeout=120) as reponse:
            lot = json.loads(reponse.read().decode("utf-8"))
        if not isinstance(lot, list):
            raise SystemExit(f"Reponse inattendue (pas une liste) : {type(lot)}")
        offres.extend(lot)
        if len(lot) < LIMITE:
            break

    for offre in offres:
        if offre.get("description"):
            continue
        detail_url = f"{API}/{offre['id']}"
        try:
            with urllib.request.urlopen(detail_url, timeout=120) as reponse:
                detail = json.loads(reponse.read().decode("utf-8"))
        except Exception as erreur:  # une fiche KO ne doit pas invalider la mesure
            print(f"  (detail illisible {offre['id']} : {erreur})", file=sys.stderr)
            continue
        offre["description"] = detail.get("description") or ""
        offre["origine_eligible"] = detail.get("origine_eligible")
    return offres


def main() -> int:
    _stdout_utf8()
    parser = argparse.ArgumentParser()
    parser.add_argument("--echantillon", type=int, default=0,
                        help="afficher N textes muets (diagnostic des motifs manquants)")
    args = parser.parse_args()

    # Import du VRAI extracteur de production : mesure = comportement reel.
    try:
        from apps.api.app.modules.matching.extraction import origine_depuis_texte
    except ImportError:
        sys.path.insert(0, ".")
        from apps.api.app.modules.matching.extraction import origine_depuis_texte

    offres = charger_catalogue()

    stockes = 0
    recuperables = 0
    muettes: list[dict] = []
    exemples: list[str] = []

    for offre in offres:
        indice_servi = offre.get("origine_eligible")
        texte = f"{offre.get('titre') or ''} {offre.get('description') or ''}"
        extrait = origine_depuis_texte(texte)

        if indice_servi:
            stockes += 1
            continue
        if extrait:
            recuperables += 1
            if len(exemples) < 3:
                exemples.append(
                    f"  [{extrait['indice']}/{extrait['preuve']}] {(offre.get('titre') or '')[:80]}"
                )
        else:
            muettes.append(offre)

    total = len(offres)
    muettes_n = len(muettes)
    couverture = (stockes + recuperables) / total * 100 if total else 0.0
    couverture_actuelle = stockes / total * 100 if total else 0.0

    print("=" * 66)
    print("MESURE ELIGIBILITE — catalogue public LAWOL")
    print("=" * 66)
    print(f"  SERVIS       : {total}")
    print(f"  STOCKES      : {stockes}  ({couverture_actuelle:.1f} % visibles par l'eleve)")
    print(f"  RECUPERABLES : {recuperables}  (texte deja stocke, extraction non posee)")
    print(f"  MUETTES      : {muettes_n}")
    print(f"  COUVERTURE SI BACKFILL : {couverture:.1f} %")
    if exemples:
        print("  Exemples recuperables :")
        print("\n".join(exemples))

    if args.echantillon:
        print("-" * 66)
        print(f"{args.echantillon} texte(s) muet(s) a inspecter :")
        for offre in muettes[: args.echantillon]:
            texte = (offre.get("description") or "").replace("\n", " ")
            print(f"\n  * {(offre.get('titre') or '')[:70]}")
            print(f"    {(offre.get('description_apercu') or texte)[:300]}")

    print("-" * 66)
    if total == 0:
        print("VERDICT : VIDE — aucune offre servie (API en reveil ou catalogue vide).")
        return 1
    if stockes + recuperables == 0:
        print("VERDICT : MUET — aucune eligibilite prouvable sur ce catalogue.")
        return 1
    print(f"VERDICT : MESURE OK — {stockes + recuperables}/{total} offres prouvables "
          f"dont {recuperables} a poser.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
