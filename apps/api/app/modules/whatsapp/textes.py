# -*- coding: utf-8 -*-
"""Textes des notifications WhatsApp — un mot d'ordre par type d'offre.

Partagé par notifier.py (matches) et sender.py (notification groupée) :
la bourse d'études a son propre libellé (« Nouvelle bourse d'études »),
les autres types gardent la formulation historique. Module séparé pour
éviter tout import circulaire sender <-> notifier.
"""

_ENTETES_TYPES = {
    "stage_pfe": "🎓 *Nouvelle offre : Stage PFE !*",
    "stage_ete": "☀️ *Nouvelle offre : Stage d'été !*",
    "emploi_junior": "💼 *Nouvelle offre : Emploi junior !*",
    "alternance": "📚 *Nouvelle offre : Alternance !*",
}


def construire_texte_notification(offre: dict) -> str:
    """Message WhatsApp d'un match, adapté au type d'offre.

    `offre` : dict avec titre, entreprise, ville, date_limite et
    idéalement type_offre (absent → formulation générique historique).
    """
    type_offre = (offre.get("type_offre") or "").lower()
    if type_offre == "bourse":
        entete = "🎓 *Nouvelle bourse d'études !*"
        libelle_org = "🏦 Organisme financeur"
        appel = "👉 Postule avant la date limite !"
    else:
        entete = _ENTETES_TYPES.get(type_offre, "🎓 *Nouvelle offre matchée !*")
        libelle_org = "🏢 Entreprise"
        appel = "👉 Postule vite !"
    return (
        f"{entete}\n\n"
        f"📌 {offre['titre']}\n"
        f"{libelle_org} : {offre['entreprise']}\n"
        f"📍 {offre['ville']}\n"
        f"📅 Date limite : {offre['date_limite']}\n\n"
        f"{appel}"
    )


def construire_texte_rappel_deadline(offre: dict, jours_restants: int) -> str:
    """Message WhatsApp de rappel J-12 / J-3 pour une offre déjà matchée.

    `offre` : dict avec titre, entreprise, ville, date_limite et idéalement
    type_offre ; `jours_restants` : écart date_limite - aujourd'hui.
    """
    type_offre = (offre.get("type_offre") or "").lower()
    if type_offre == "bourse":
        entete = "⏳ *Rappel : ta bourse se termine bientôt !*"
        libelle_org = "🏦 Organisme financeur"
    else:
        entete = "⏳ *Rappel : l'offre se termine bientôt !*"
        libelle_org = "🏢 Entreprise"
    if jours_restants <= 0:
        fin = "⚠️ Dernier jour pour postuler !"
    elif jours_restants == 1:
        fin = "⚠️ C'est demain la date limite !"
    else:
        fin = f"🔥 Plus que {jours_restants} jours pour postuler !"
    return (
        f"{entete}\n\n"
        f"📌 {offre['titre']}\n"
        f"{libelle_org} : {offre['entreprise']}\n"
        f"📍 {offre['ville']}\n"
        f"📅 Date limite : {offre['date_limite']}\n\n"
        f"{fin}"
    )
