"""Preuve du résumé hebdomadaire par email — zéro réseau, zéro SMTP.

Ce que ce harnais PROUVE (et pas seulement « ça tourne ») :

1. **0 offre = 0 email** : un profil sans nouveauté ne reçoit rien (un résumé
   vide est du bruit, et un email vide est le meilleur moyen d'être signalé
   comme spam) ;
2. **anti-doublon par semaine ISO** : relancer le job 3 fois la même semaine
   n'envoie qu'un email, même si la fenêtre de 7 jours recouvre encore des
   offres ;
3. **l'état n'est écrit qu'après un envoi réussi** : une panne du transport
   laisse `profils.metadata` intact → le profil repart au run suivant ;
4. **un profil en erreur n'arrête pas les suivants** ;
5. **honnêteté du contenu** : le type affiché est le type réel (un emploi
   junior n'est jamais annoncé « Bourse d'études »), l'offre expirée, inactive
   ou marquée « pas intéressé » n'est pas renvoyée ;
6. **simulation par défaut** (ni écriture ni envoi) et endpoint admin gardé.

Usage : python -X utf8 scripts/test-resume-hebdo.py
"""
import asyncio
import copy
import os
import re
import sys
import types
from datetime import UTC, datetime, timedelta
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
os.environ.setdefault("SESSION_SECRET", "session-de-test-bidon-" + "x" * 32)

AUJOURDHUI = datetime.now(UTC).date()
SEMAINE_DERNIERE = AUJOURDHUI - timedelta(days=3)
SEMAINE_PROCHAINE = AUJOURDHUI + timedelta(days=7)

CHECKS: list[tuple[bool, str]] = []


def check(condition, libelle, detail=""):
    CHECKS.append((bool(condition), libelle))
    etat = "OK " if condition else "KO "
    print(f"  [{etat}] {libelle}" + ("" if condition else f"  → {detail}"))


# ------------------------------- Faux Supabase --------------------------------
def _valeur(ligne, colonne):
    """Valeur d'une colonne, chemin imbriqué (`offre.active`) inclus."""
    if "." in colonne:
        table, reste = colonne.split(".", 1)
        sous = ligne.get(table)
        return _valeur(sous, reste) if isinstance(sous, dict) else None
    return ligne.get(colonne)


class _Resultat:
    def __init__(self, data):
        self.data = data


class _Table:
    def __init__(self, base, nom):
        self._base, self._nom = base, nom
        self._filtres: list[tuple[str, str, object]] = []
        self._ordre = None
        self._limite = None
        self._mode = "select"
        self._donnees = None

    def select(self, *_a, **_k):
        return self

    def eq(self, colonne, valeur):
        self._filtres.append(("eq", colonne, valeur))
        return self

    def gte(self, colonne, valeur):
        self._filtres.append(("gte", colonne, valeur))
        return self

    def order(self, colonne, desc=False):
        self._ordre = (colonne, desc)
        return self

    def limit(self, n):
        self._limite = n
        return self

    def update(self, donnees):
        self._mode, self._donnees = "update", copy.deepcopy(donnees)
        return self

    def _correspond(self, ligne) -> bool:
        for operation, colonne, valeur in self._filtres:
            actuelle = _valeur(ligne, colonne)
            if operation == "eq" and actuelle != valeur:
                return False
            if operation == "gte" and str(actuelle or "") < str(valeur):
                return False
        return True

    def execute(self):
        if self._mode == "update":
            for ligne in self._base.tables.get(self._nom, []):
                if self._correspond(ligne):
                    ligne.update(self._donnees)
            self._base.maj.append(
                (self._nom, list(self._filtres), dict(self._donnees))
            )
            return _Resultat([])

        lignes = [
            copy.deepcopy(ligne)
            for ligne in self._base.tables.get(self._nom, [])
            if self._correspond(ligne)
        ]
        if self._ordre:
            colonne, desc = self._ordre
            lignes.sort(key=lambda l: str(_valeur(l, colonne) or ""), reverse=desc)
        if self._limite is not None:
            lignes = lignes[: self._limite]
        return _Resultat(lignes)


class FauxSupabase:
    def __init__(self, profils, matches):
        self.tables = {"profils": profils, "matches": matches}
        self.maj: list[tuple] = []

    def table(self, nom):
        return _Table(self, nom)


def offre(ident, titre, type_offre="bourse", jours=20, active=True, entreprise="Organisme"):
    return {
        "id": ident,
        "titre": titre,
        "entreprise": entreprise,
        "ville": "nouakchott",
        "pays_etudes": "france",
        "type_offre": type_offre,
        "date_limite": (AUJOURDHUI + timedelta(days=jours)).isoformat(),
        "active": active,
    }


def match(ident, offre_dict, jours_match=1, statut=None, profil="p1"):
    return {
        "id": ident,
        "profil_id": profil,
        "date_match": (AUJOURDHUI - timedelta(days=jours_match)).isoformat(),
        "statut_candidature": statut,
        "offre": offre_dict,
    }


def profils_base():
    return [
        {
            "id": "p1",
            "telephone": "22230000001",
            "email": "amina@exemple.mr",
            "prenom": "Amina",
            "nom": "Diallo",
            "actif": True,
            "metadata": {"code_pin_hash": "abc"},
        },
        {
            "id": "p2",
            "telephone": "22230000002",
            "email": "moussa@exemple.mr",
            "prenom": "Moussa",
            "nom": "Ba",
            "actif": True,
            "metadata": {},
        },
        {
            "id": "p3",
            "telephone": "22230000003",
            "email": None,
            "prenom": "Sans",
            "nom": "Adresse",
            "actif": True,
            "metadata": {},
        },
    ]


def main() -> int:
    profils = profils_base()
    matches = [
        # Amina : 2 offres utiles (dont un emploi junior) + 1 expirée + 1 inactive
        # + 1 déjà écartée.
        match("m1", offre("o1", "Bourse Chevening 2027", entreprise="UK Government")),
        match(
            "m2",
            offre("o2", "Data Analyst Junior", type_offre="emploi_junior", jours=9),
        ),
        match("m3", offre("o3", "Bourse expirée", jours=-4)),
        match("m4", offre("o4", "Bourse inactive", active=False)),
        match("m5", offre("o5", "Bourse écartée"), statut="pas_interesse"),
        match(
            "m6",
            offre("o6", "Bourse arrivée il y a 8 jours"),
            jours_match=8,
        ),
        # Moussa : aucune offre dans la fenêtre (match trop vieux)
        match("m7", offre("o7", "Vieille bourse"), jours_match=30, profil="p2"),
        # Profil 3 (sans email)
        match("m8", offre("o8", "Bourse pour sans adresse"), profil="p3"),
    ]
    faux = FauxSupabase(profils, matches)

    _supabase = types.ModuleType("supabase")
    _supabase.Client = object
    _supabase.create_client = lambda url, key=None, **kw: faux
    sys.modules["supabase"] = _supabase  # AVANT l'import de l'app

    from apps.api.app.modules.notifications import resume_hebdo as module

    envois: list[tuple[str, str, str]] = []
    echecs = {"actif": False}

    def faux_envoi(profil, texte, sujet):
        if echecs["actif"]:
            raise RuntimeError("SMTP indisponible (preuve)")
        envois.append((str(profil.get("telephone")), sujet, texte))
        return True

    print("=== 1. Simulation par défaut : ni écriture, ni envoi ===")
    bilan = module.run_resume_hebdo(aujourdhui=AUJOURDHUI, envoi=faux_envoi)
    check(bilan["mode"] == "simulation", f"mode = {bilan['mode']}")
    check(bilan["envoyes"] >= 1, f"{bilan['envoyes']} envoi(s) simulé(s)")
    check(not envois, "aucun email réellement envoyé en simulation")
    check(not faux.maj, "aucune écriture en base en simulation")

    print("=== 2. Fenêtre, exclusions et contenu honnête ===")
    bilan = module.run_resume_hebdo(
        aujourdhui=AUJOURDHUI, appliquer=True, envoi=faux_envoi
    )
    par_tel = {t: (sujet, texte) for t, sujet, texte in envois}
    for detail in bilan["details"]:
        if detail["etat"] == "erreur":
            print(f"    ! erreur profil {detail['profil']} : {detail.get('erreur')}")
    amina = par_tel.get("22230000001", ("", ""))
    check("22230000001" in par_tel, f"envois : {sorted(par_tel)}")
    check("1 nouvelle offre" in amina[0], f"sujet = {amina[0]!r}")
    check("Bourse Chevening 2027" in amina[1], "titre présent dans le corps")
    # DÉCISION PRODUIT (rappelée par l'utilisateur le 27/10) : le site ne
    # présente QUE des bourses. Un email qui glisserait une offre d'emploi
    # contredirait le produit — et l'étudiant ne peut même pas la retrouver sur
    # le site pour la masquer. L'emploi junior du jeu de données doit donc être
    # ABSENT (il est présent exprès, comme piège).
    check(
        "Data Analyst Junior" not in amina[1],
        "aucune offre d'emploi dans l'email (catalogue 100 % bourses)",
        amina[1][:200],
    )
    check(
        amina[1].count("Emploi junior") == 0
        and amina[1].count("Bourse d'études") == 1,
        "une seule ligne, libellée « Bourse d'études »",
        amina[1][:200],
    )
    check("/offres/o1" in amina[1], "lien vers la fiche")
    check("/profil/22230000001" in amina[1], "lien vers l'espace du profil")
    check(
        "expirée" not in amina[1].lower() and "inactive" not in amina[1].lower(),
        "offres expirée/inactive absentes",
    )
    check("écartée" not in amina[1], "offre marquée « pas intéressé » absente")
    check("Bonjour Amina," in amina[1], "personnalisation par le prénom")

    print("=== 3. 0 nouveauté = 0 email ; sans adresse = ni email ni erreur ===")
    check("22230000002" not in par_tel, "profil sans nouveauté : aucun email")
    check(bilan["sans_nouveaute"] >= 1, f"sans_nouveaute = {bilan['sans_nouveaute']}")
    check(bilan["erreurs"] == 0, f"erreurs = {bilan['erreurs']}")

    # Profil SANS adresse : transport réel (aucun réseau possible, l'absence
    # d'adresse est refusée avant toute connexion) → ni email, ni « erreur »
    # (sinon il serait en échec à chaque semaine, pour toujours).
    module.supabase = FauxSupabase(profils_base()[2:], matches)
    bilan_sans = module.run_resume_hebdo(aujourdhui=AUJOURDHUI, appliquer=True)
    check(
        bilan_sans["sans_adresse"] == 1 and bilan_sans["erreurs"] == 0,
        f"sans_adresse={bilan_sans['sans_adresse']} erreurs={bilan_sans['erreurs']}",
    )
    module.supabase = faux

    print("=== 4. Anti-doublon : la même semaine ISO n'envoie qu'une fois ===")
    envois.clear()
    faux.maj.clear()
    bilan = module.run_resume_hebdo(
        aujourdhui=AUJOURDHUI, appliquer=True, envoi=faux_envoi
    )
    check(not envois, f"aucun email au 2ᵉ passage : {envois}")
    check(bilan["deja_servis"] >= 1, f"deja_servis = {bilan['deja_servis']}")
    amina_meta = next(p for p in faux.tables["profils"] if p["id"] == "p1")["metadata"]
    check(
        amina_meta.get(module.CLE_DERNIER_RESUME) == AUJOURDHUI.isoformat(),
        f"metadata['dernier_resume'] = {amina_meta.get(module.CLE_DERNIER_RESUME)}",
    )
    check(amina_meta.get("code_pin_hash") == "abc", "les autres clés metadata sont conservées")

    print("=== 5. Semaine suivante : un profil déjà servi est resservi ===")
    # La fenêtre glisse sur 7 jours : une offre arrivée dans la semaine N+1
    # doit partir, même si le profil a déjà reçu le résumé de la semaine N.
    profil_servi = profils_base()[:1]
    profil_servi[0]["metadata"] = {module.CLE_DERNIER_RESUME: AUJOURDHUI.isoformat()}
    nouveau = [
        match(
            "n1",
            offre("o9", "Bourse toute fraîche"),
            jours_match=-2,  # arrivée APRÈS la semaine précédente
        )
    ]
    module.supabase = FauxSupabase(profil_servi, nouveau)
    envois.clear()
    bilan = module.run_resume_hebdo(
        aujourdhui=SEMAINE_PROCHAINE, appliquer=True, envoi=faux_envoi
    )
    check(
        any(t == "22230000001" for t, _, _ in envois),
        f"profil resservi la semaine suivante : {[t for t, _, _ in envois]}",
    )
    check(bilan["deja_servis"] == 0, f"pas vu comme déjà servi : {bilan['deja_servis']}")
    module.supabase = faux

    print("=== 6. Une panne d'envoi n'est pas un succès (et n'arrête pas les autres) ===")
    faux2 = FauxSupabase(profils_base(), matches)
    module.supabase = faux2
    envois.clear()
    echecs["actif"] = True
    bilan = module.run_resume_hebdo(
        aujourdhui=AUJOURDHUI, appliquer=True, envoi=faux_envoi
    )
    profils_apres = {p["id"]: p["metadata"] for p in faux2.tables["profils"]}
    check(bilan["erreurs"] >= 1, f"erreurs = {bilan['erreurs']}")
    check(
        module.CLE_DERNIER_RESUME not in profils_apres["p1"],
        "aucun état écrit après un échec (le profil repartira)",
        str(profils_apres["p1"]),
    )
    check(
        bilan["profils"] >= 2,
        f"les profils suivants ont bien été examinés ({bilan['profils']})",
    )
    echecs["actif"] = False

    print("=== 7. Déduplication et plafond de 12 offres ===")
    # 20 matches sur 20 offres DISTINCTES → le corps doit en contenir 12 max.
    beaucoup = [
        match(f"d{i}", offre(f"u{i}", f"Offre distincte {i}")) for i in range(20)
    ]
    faux3 = FauxSupabase(profils_base()[:1], beaucoup)
    module.supabase = faux3
    envois.clear()
    module.run_resume_hebdo(aujourdhui=AUJOURDHUI, appliquer=True, envoi=faux_envoi)
    texte = envois[0][2] if envois else ""
    check(texte.count("• ") == 12, f"plafond respecté : {texte.count('• ')} offre(s)")
    check("Offre distincte 0" in texte, "les plus récentes d'abord")

    # Deux matches sur la MÊME offre ne doivent produire qu'une ligne.
    doublon = [
        match("x1", offre("o1", "Bourse unique")),
        match("x2", offre("o1", "Bourse unique")),
    ]
    module.supabase = FauxSupabase(profils_base()[:1], doublon)
    envois.clear()
    module.run_resume_hebdo(aujourdhui=AUJOURDHUI, appliquer=True, envoi=faux_envoi)
    texte = envois[0][2] if envois else ""
    check(texte.count("• ") == 1, f"offre dédupliquée : {texte.count('• ')} ligne(s)")

    print("=== 8. Endpoint admin (simulation par défaut, garde appelée) ===")
    module.supabase = FauxSupabase(profils_base(), matches)
    import apps.api.app.main as api

    appels = {"n": 0}
    api._admin_autorise = lambda _request: appels.__setitem__("n", appels["n"] + 1)
    bilan_api = asyncio.run(api.trigger_resume_hebdo(request=None))
    check(appels["n"] == 1, "garde admin appelée")
    check(
        bilan_api["mode"] == "simulation",
        f"défaut = simulation ({bilan_api['mode']})",
    )

    print("=== 9. Workflow : lundi, gardé, envoi explicite ===")
    workflow = (RACINE / ".github" / "workflows" / "resume-hebdo.yml").read_text(
        encoding="utf-8"
    )
    check("cron: '0 7 * * 1'" in workflow, "déclenchement hebdomadaire (lundi)")
    check("appliquer=true" in workflow, "l'envoi réel est explicite")
    variable = re.search(r"x-admin-token:\s*\$([A-Za-z_][A-Za-z0-9_]*)", workflow)
    check(
        bool(variable)
        and f"{variable.group(1)}: ${{{{ secrets.SCRAPER_TOKEN }}}}" in workflow,
        "jeton admin fourni par secrets.SCRAPER_TOKEN (jamais en clair)",
    )

    print("=== 10. Proxy Next : relais d'identité et simulation par défaut ===")
    # Règle locale LAWOL.mr : tout endpoint /api/v1/* a sa route proxy Next, et
    # un proxy d'endpoint GARDÉ doit relayer l'identité admin (sinon 401
    # systématique — mesuré le 20/10 sur /matching/run).
    proxy = (
        RACINE / "apps" / "web" / "app" / "api" / "v1" / "notifications"
        / "resume-hebdo" / "route.ts"
    )
    source_proxy = proxy.read_text(encoding="utf-8") if proxy.exists() else ""
    check(proxy.exists(), f"proxy Next présent : {proxy.name}")
    check(
        "x-admin-token" in source_proxy
        and "authorization" in source_proxy.lower()
        and "cookie" in source_proxy.lower(),
        "le proxy relaie les 3 transports d'identité admin",
    )
    # Le proxy ne doit pas forcer l'envoi : le paramètre vient de l'appelant.
    # Invariant vérifié = l'URL du fetch n'écrit pas `appliquer=true` en dur
    # (un proxy qui forcerait l'envoi enverrait de vrais emails depuis la page).
    url_fetch = re.search(r"fetch\(\s*`([^`]+)`", source_proxy)
    cible = url_fetch.group(1) if url_fetch else ""
    check(
        "appliquer=true" not in cible and "searchParams.get" in source_proxy,
        "le proxy ne force jamais l'envoi (simulation par défaut)",
        f"cible={cible!r}",
    )

    ok = sum(1 for c, _ in CHECKS if c)
    print(f"\n=== BILAN : {ok}/{len(CHECKS)} checks verts ===")
    return 0 if ok == len(CHECKS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
