"""Harnais — l'étudiant REÇOIT-il réellement les bourses calculées ? (Lot A)

Mesure hors-ligne (faux Supabase, zéro réseau) de l'émission :
  1. un match d'un profil SANS email entre-t-il dans le lot ?
  2. un profil sans email est-il servi par WhatsApp ?
  3. un échec d'envoi laisse-t-il le match en attente (aucune perte) ?
  4. le quota hebdo de 5 envois est-il respecté ?
  5. le consentement donné par `optin_texte` SEUL (0 profil sur 4 avait
     `metadata.optin_at` en prod le 15/11/2026) suffit-il à déclencher l'envoi ?
  6. un profil sans AUCUN consentement (ni `optin_at`, ni `optin_texte` non
     vide) est-il bien ignoré, sans envoi et sans marquage ?
  7. les workflows planifient-ils réellement l'émission, et pointent-ils l'hôte vivant ?

Invariant vérifié, jamais la forme littérale d'un fichier :
l'émission est planifiée si un workflow suivi contient l'appel au job ; l'hôte est sain
si aucune URL `railway` ne subsiste.

Exit 0 = tout vert. Exit 1 = au moins un KO (le détail dit lequel).
"""
from __future__ import annotations

import sys
from datetime import date, timedelta
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from apps.api.app.modules.whatsapp import notifier

ECHECS: list[str] = []


def check(libelle: str, condition: bool, detail: str = "") -> None:
    if condition:
        print(f"  [OK] {libelle}")
        return
    print(f"  [KO] {libelle}{(' — ' + detail) if detail else ''}")
    ECHECS.append(libelle)


# ----------------------------------------------------------------- faux Supabase
class _Rep:
    def __init__(self, data):
        self.data = data


class _Table:
    """Applique les filtres utilisés par notifier.py sur des lignes en mémoire."""

    def __init__(self, lignes: list[dict]):
        # Références, PAS des copies : un update doit se voir dans la liste d'essai.
        self._lignes = list(lignes)
        self._filtres: list = []
        self._limite: int | None = None
        self._maj: dict | None = None
        self._negation = False

    def select(self, *_a, **_k):
        return self

    def eq(self, cle: str, valeur):
        self._filtres.append(("eq", cle, valeur))
        return self

    def gte(self, cle: str, valeur):
        self._filtres.append(("gte", cle, valeur))
        return self

    def is_(self, cle: str, valeur):
        self._filtres.append(("is_not" if self._negation else "is", cle, valeur))
        self._negation = False
        return self

    @property
    def not_(self):
        self._negation = True
        return self

    def limit(self, n: int):
        self._limite = n
        return self

    def order(self, *_a, **_k):
        return self

    def update(self, valeurs: dict):
        self._maj = dict(valeurs)
        return self

    def execute(self):
        lignes = list(self._lignes)
        for op, cle, valeur in self._filtres:
            if op == "eq":
                lignes = [l for l in lignes if _lire(l, cle) == valeur]
            elif op == "gte":
                lignes = [l for l in lignes if str(_lire(l, cle) or "") >= str(valeur)]
            elif op == "is" and valeur == "null":
                lignes = [l for l in lignes if _lire(l, cle) is None]
            elif op == "is_not" and valeur == "null":
                lignes = [l for l in lignes if _lire(l, cle) is not None]
        if self._maj is not None:
            for l in lignes:
                l.update(self._maj)
            return _Rep(lignes)
        if self._limite is not None:
            lignes = lignes[: self._limite]
        return _Rep(lignes)


def _lire(ligne: dict, chemin: str):
    courant = ligne
    for morceau in chemin.split("."):
        if not isinstance(courant, dict):
            return None
        courant = courant.get(morceau)
    return courant


class _FauxSupabase:
    def __init__(self, matches: list[dict]):
        self.matches = matches

    def table(self, nom: str):
        if nom != "matches":
            raise AssertionError(f"table inattendue : {nom}")
        return _Table(self.matches)


# ----------------------------------------------------------------- données d'essai
AUJ = date.today()  # noqa: DTZ011 — date locale voulue (fenêtre de quota en jours)


def JOUR(n: int) -> str:
    return (AUJ + timedelta(days=n)).isoformat()


def _profil(
    pid: str,
    *,
    email: str | None,
    telephone: str | None,
    actif: bool = True,
    optin_at: str | None = "2026-10-01T09:00:00+00:00",
    optin_texte: str | None = None,
):
    """Profil d'essai — les DEUX sources de consentement sont pilotables.

    Mesure prod 15/11/2026 : 4 profils sur 4 avaient `optin_texte`, 0 sur 4
    `metadata.optin_at` → un harnais qui ne pose que `optin_at` ne mesure pas
    la réalité. `optin_at=None` reproduit donc le cas réel.
    """
    return {
        "id": pid,
        "prenom": "Etudiant",
        "nom": pid,
        "telephone": telephone,
        "email": email,
        "filiere": "informatique",
        "niveau": "M2",
        "actif": actif,
        "optin_texte": optin_texte,
        "metadata": {"optin_at": optin_at} if optin_at else {},
    }


def _offre(oid: str):
    return {
        "id": oid,
        "titre": f"Bourse {oid}",
        "entreprise": "Fondation",
        "ville": "paris",
        "date_limite": JOUR(30),
        "type_offre": "bourse",
        "active": True,
    }


def _match(mid: str, profil: dict, offre: dict, *, notifie=False, date_match=None):
    return {
        "id": mid,
        "score": 80,
        "notifie": notifie,
        "date_match": date_match or JOUR(-1),
        "profil_id": profil["id"],
        "profil": profil,
        "offre": offre,
    }


def _executer(matches: list[dict], envoi):
    notifier.supabase = _FauxSupabase(matches)
    return notifier.run_notification_job(envoi=envoi, aujourdhui=AUJ)


# ----------------------------------------------------------------- 1. sans email
print("=== 1. Un étudiant SANS email entre-t-il dans le lot ? ===")
envoyes: list[tuple] = []
sans_email = _profil("p-sans-email", email=None, telephone="22200000001")
matches = [_match("m1", sans_email, _offre("o1"))]
stats = _executer(matches, lambda tel, txt: envoyes.append((tel, txt)))
check(
    "le match d'un profil sans email est examiné",
    stats["matches_trouves"] == 1,
    f"matches_trouves={stats['matches_trouves']} (attendu 1)",
)
check(
    "le profil sans email est servi par WhatsApp",
    len(envoyes) == 1 and envoyes[0][0] == "22200000001",
    f"envois={envoyes}",
)
check("le match est marqué notifié", matches[0]["notifie"] is True, str(matches[0]["notifie"]))

# ----------------------------------------------------------------- 2. échec d'envoi
print("\n=== 2. Un échec d'envoi perd-il le match ? ===")
profil_ko = _profil("p-ko", email="ko@exemple.mr", telephone="22200000002")
matches_ko = [_match("m2", profil_ko, _offre("o2"))]


def _envoi_qui_echoue(tel, txt):
    raise RuntimeError("canal mort")


stats = _executer(matches_ko, _envoi_qui_echoue)
check("l'échec est compté en erreur", stats["erreurs"] == 1, f"erreurs={stats['erreurs']}")
check("le match reste en attente (aucune perte)", matches_ko[0]["notifie"] is False, str(matches_ko[0]["notifie"]))

# ----------------------------------------------------------------- 3. quota hebdo
print("\n=== 4. Le quota hebdomadaire de 5 envois est-il tenu ? ===")
profil_q = _profil("p-quota", email="q@exemple.mr", telephone="22200000003")
matches_q = [
    _match(f"q{i}", profil_q, _offre(f"oq{i}"), notifie=True, date_match=JOUR(-2)) for i in range(5)
]
matches_q.append(_match("q6", profil_q, _offre("oq6")))
envoyes.clear()
stats = _executer(matches_q, lambda tel, txt: envoyes.append((tel, txt)))
check("0 envoi quand le quota est atteint", len(envoyes) == 0, f"envois={len(envoyes)}")
check("le 6e match est ignoré, pas supprimé", stats["ignores"] >= 1, str(stats))

# ----------------------------------------------------------------- 5. optin_texte
print("\n=== 5. Le consentement par `optin_texte` SEUL suffit-il à envoyer ? ===")
envoyes.clear()
profil_texte = _profil(
    "p-texte-seul",
    email="texte@exemple.mr",
    telephone="22200000004",
    optin_at=None,  # cas mesuré en prod : 0 profil sur 4 avait optin_at
    optin_texte="J'accepte de recevoir des notifications WhatsApp.",
)
matches_texte = [_match("m5", profil_texte, _offre("o5"))]
stats = _executer(matches_texte, lambda tel, txt: envoyes.append((tel, txt)))
check(
    "optin_texte seul → le match est envoyé",
    len(envoyes) == 1 and envoyes[0][0] == "22200000004",
    f"envois={envoyes}",
)
check("optin_texte seul → 1 notification comptée", stats["notifies"] == 1, str(stats))
check("optin_texte seul → 0 ignoré", stats["ignores"] == 0, str(stats))
check("optin_texte seul → match marqué notifié", matches_texte[0]["notifie"] is True, str(matches_texte[0]["notifie"]))

# ----------------------------------------------------------------- 6. aucun consentement
print("\n=== 6. Ni `optin_at` ni `optin_texte` → ignoré, aucun envoi ? ===")
# "blanc" = consentement vide/espaces : la colonne existe mais ne dit rien
for etiquette, texte_consentement in (("absent", None), ("blanc", "   ")):
    envoyes.clear()
    profil_muet = _profil(
        f"p-muet-{etiquette}",
        email=f"muet-{etiquette}@exemple.mr",
        telephone="22200000005",
        optin_at=None,
        optin_texte=texte_consentement,
    )
    matches_muet = [_match(f"m6-{etiquette}", profil_muet, _offre(f"o6-{etiquette}"))]
    stats = _executer(matches_muet, lambda tel, txt: envoyes.append((tel, txt)))
    check(
        f"aucun consentement ({etiquette}) → 0 envoi",
        len(envoyes) == 0,
        f"envois={envoyes}",
    )
    check(
        f"aucun consentement ({etiquette}) → ignoré, pas notifié",
        stats["ignores"] == 1 and stats["notifies"] == 0,
        str(stats),
    )
    check(
        f"aucun consentement ({etiquette}) → match laissé en attente",
        matches_muet[0]["notifie"] is False,
        str(matches_muet[0]["notifie"]),
    )

# ----------------------------------------------------------------- 7. workflows
print("\n=== 7. L'émission est-elle réellement planifiée ? ===")
flux = sorted((RACINE / ".github" / "workflows").glob("*.yml"))
textes = {f.name: f.read_text(encoding="utf-8", errors="replace") for f in flux}
print(f"  workflows suivis : {', '.join(textes) or 'AUCUN'}")

emission = [nom for nom, txt in textes.items() if "/api/v1/notifications/run" in txt]
rappels = [nom for nom, txt in textes.items() if "/api/v1/notifications/deadlines" in txt]
check(
    "un workflow planifie l'envoi des matches",
    bool(emission),
    "aucun workflow n'appelle /api/v1/notifications/run",
)
check(
    "un workflow planifie les rappels d'échéance",
    bool(rappels),
    "aucun workflow n'appelle /api/v1/notifications/deadlines",
)

railway = [nom for nom, txt in textes.items() if "railway" in txt.lower()]
check(
    "aucun workflow ne pointe l'hôte Railway mort",
    not railway,
    f"à corriger : {', '.join(railway)}",
)

# ----------------------------------------------------------------- bilan
print("\n" + "=" * 62)
if ECHECS:
    print(f"BILAN : {len(ECHECS)} KO — l'étudiant ne reçoit pas ce qui est calculé")
    for e in ECHECS:
        print(f"  - {e}")
    sys.exit(1)
print("BILAN : émission prouvée — tout match valide atteint un canal")
sys.exit(0)
