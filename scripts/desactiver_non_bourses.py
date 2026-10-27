# -*- coding: utf-8 -*-
"""Désactive les offres qui ne sont PAS des bourses (décision produit 16/10/2026).

Le catalogue LAWOL.mr est « 100 % bourses ». Les sources d'emploi (beta.mr,
LinkedIn, sites carrières) et les stages ont été écartés du site — mais les
lignes correspondantes sont restées `active=true` en base. Elles ne s'affichent
plus (le front envoie `type_offre=bourse`), sauf que **toute lecture qui oublie
ce filtre les ressert** : l'API publique sans paramètre, une notification, un
export, un futur client mobile. « Éliminé du site » doit vouloir dire « plus
servi par personne », pas « caché par une page ».

Mesure du 27/10/2026 : 298 offres actives non expirées, dont 265 bourses et
33 non-bourses (31 `emploi_junior`, 2 `stage_pfe`).

Usage :
    python -X utf8 scripts/desactiver_non_bourses.py           # simulation
    python -X utf8 scripts/desactiver_non_bourses.py --apply   # écrit

Réversible : `active=false` n'efface rien ; repasser à `true` suffit à
réactiver une ligne. Zéro suppression, zéro migration.
"""
import argparse
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

TAILLE_LOT = 100


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Désactive les offres non-bourses (catalogue 100 % bourses)"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="écrit réellement (défaut : simulation)",
    )
    args = parser.parse_args()

    from apps.api.app.core.database import supabase

    res = (
        supabase.table("offres")
        .select("id, titre, type_offre, source_name, active")
        .eq("active", True)
        .limit(2000)
        .execute()
    )
    offres = res.data or []
    a_desactiver = [o for o in offres if (o.get("type_offre") or "") != "bourse"]

    print(f"offres actives : {len(offres)}")
    print(f"bourses        : {len(offres) - len(a_desactiver)}")
    print(f"non-bourses    : {len(a_desactiver)}")
    par_type: dict[str, int] = {}
    for o in a_desactiver:
        cle = f"{o.get('type_offre')} ({o.get('source_name')})"
        par_type[cle] = par_type.get(cle, 0) + 1
    for cle, n in sorted(par_type.items(), key=lambda kv: -kv[1]):
        print(f"  {cle:<45} {n}")

    if not args.apply:
        print("\nsimulation : aucune écriture. Relancer avec --apply.")
        for o in a_desactiver[:10]:
            print(f"  ~ {o['id'][:8]} | {o.get('type_offre')} | {(o.get('titre') or '')[:60]}")
        return 0

    faits = 0
    for debut in range(0, len(a_desactiver), TAILLE_LOT):
        lot = a_desactiver[debut : debut + TAILLE_LOT]
        ids = [o["id"] for o in lot]
        supabase.table("offres").update({"active": False}).in_("id", ids).execute()
        faits += len(ids)
        print(f"  lot {debut // TAILLE_LOT + 1} : {len(ids)} désactivée(s)")

    # Contrôle APRÈS écriture (ne jamais annoncer sans remesurer).
    apres = (
        supabase.table("offres")
        .select("id, type_offre")
        .eq("active", True)
        .limit(2000)
        .execute()
    )
    restants = [o for o in (apres.data or []) if (o.get("type_offre") or "") != "bourse"]
    print(f"\n{faits} offre(s) désactivée(s) ; non-bourses encore actives : {len(restants)}")
    return 0 if not restants else 1


if __name__ == "__main__":
    raise SystemExit(main())
