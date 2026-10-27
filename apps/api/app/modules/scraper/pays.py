# -*- coding: utf-8 -*-
"""Détection du pays d'études depuis le texte (titre + description + URL).

Règle : par mots-clés explicites uniquement → valeur de l'enum `PaysEtudes`.
`None` si aucun indice (jamais deviné).
"""
import re
from typing import Optional

from apps.api.app.modules.shared.models import PaysEtudes

# Mots-clés → PaysEtudes (valeurs exactes de l'enum).
# Ordre : formes longues d'abord pour éviter "usa" avant "united states", etc.
# On couvre EN + FR + variantes courantes. AUCUN fallback : absence = None.
PAYS_MOTS_CLES: dict[PaysEtudes, tuple[str, ...]] = {
    # Europe
    PaysEtudes.FRANCE: (
        "france", "french", "français", "francaise", "paris", "lyon", "marseille",
        "toulouse", "bordeaux", "lille", "nice", "nantes", "strasbourg", "montpellier",
        "grenoble", "rennes", "reims", "le havre", "saint-etienne", "toulon",
        "sorbone", "sciences po", "hec", "polytechnique", "mines", "centrale",
        "inseec", "emlyon", "edhec", "escp", "kedge", "neoma", "audencia",
    ),
    PaysEtudes.CANADA: (
        "canada", "canadian", "canadien", "canadienne", "ontario", "quebec",
        "québec", "montreal", "montréal", "toronto", "vancouver", "ottawa",
        "calgary", "edmonton", "winnipeg", "quebec city", "waterloo", "mcgill",
        "concordia", "ubc", "université de montréal", "université laval",
        "université de sherbrooke", "hec montréal", "polytechnique montréal",
    ),
    PaysEtudes.USA: (
        "usa", "united states", "etats-unis", "états-unis", "america", "américain",
        "american", "new york", "california", "boston", "chicago", "texas",
        "florida", "washington", "harvard", "mit", "stanford", "berkeley",
        "yale", "princeton", "columbia", "pennsylvania", "cornell", "duke",
        "johns hopkins", "northwestern", "ucla", "usc", "nyu", "cmu",
        "georgia tech", "texas a&m", "purdue", "uc san diego", "uc davis",
        "university of michigan", "university of chicago", "brown", "dartmouth",
    ),
    PaysEtudes.ALLEMAGNE: (
        "allemagne", "germany", "german", "allemand", "allemande", "berlin",
        "munich", "munchen", "münchen", "hamburg", "hambourg", "frankfurt",
        "cologne", "koln", "köln", "stuttgart", "dusseldorf", "düsseldorf",
        "dortmund", "essen", "leipzig", "dresden", "bremen", "hannover",
        "nuremberg", "tu berlin", "tu munich", "rwth aachen",
        "université de heidelberg", "université de freibourg", "université de tübingen",
    ),
    PaysEtudes.ROYAUME_UNI: (
        "royaume-uni", "royaume uni", "united kingdom", "uk", "british", "britannique",
        "angleterre", "ecosse", "écosse", "pays de galles", "irlande du nord",
        "london", "londres", "oxford", "cambridge", "edinburgh", "édimbourg",
        "glasgow", "manchester", "birmingham", "leeds", "liverpool", "bristol",
        "sheffield", "nottingham", "newcastle", "southampton", "king's college",
        "ucl", "imperial college", "lse", "university of london", "durham",
        "warwick", "st andrews", "bath", "lancaster", "exeter", "york",
    ),
    PaysEtudes.ESPAGNE: (
        "espagne", "spain", "espagnol", "espagnole", "madrid", "barcelona",
        "barcelone", "valencia", "valence", "seville", "séville", "malaga",
        "málaga", "zaragoza", "murcia", "palma", "bilbao", "alicante",
        "complutense", "autonoma de madrid", "polytechnique de madrid",
        "université de barcelone", "université de valence",
    ),
    PaysEtudes.ITALIE: (
        "italie", "italy", "italien", "italienne", "rome", "milan", "milano",
        "naples", "napoli", "turin", "torino", "palermo", "genoa", "genève",
        "bologne", "florence", "firenze", "catania", "bari", "venise", "venezia",
        "politecnico di milano", "politecnico di torino", "université de bologne",
        "sapienza", "luiss", "bocconi",
    ),
    PaysEtudes.BELGIQUE: (
        "belgique", "belgium", "belge", "bruxelles", "antwerp", "anvers",
        "gand", "gent", "liege", "liège", "charleroi", "bruges", "namur",
        "kuleuven", "ulb", "uclouvain", "vub", "ulg",
    ),
    PaysEtudes.SUISSE: (
        "suisse", "switzerland", "swiss", "suisse", "zurich", "zürich", "geneve",
        "genève", "basel", "bâle", "bern", "berne", "lausanne", "lucerne",
        "st gallen", "fribourg", "neuchatel", "neuchâtel", "epfl", "eth",
        "université de genève", "université de lausanne", "université de zurich",
    ),
    PaysEtudes.PAYS_BAS: (
        "pays-bas", "pays bas", "netherlands", "holland", "hollande", "néerlandais",
        "neerlandais", "amsterdam", "rotterdam", "la haye", "utrecht", "eindhoven",
        "tilburg", "groningen", "maastricht", "delft", "twente", "wageningen",
        "université d'amsterdam", "vu amsterdam", "erasmus rotterdam",
        "tu delft", "tu eindhoven", "université de groningen",
    ),
    PaysEtudes.SUEDE: (
        "suede", "suède", "sweden", "suédois", "suedois", "stockholm", "goteborg",
        "göteborg", "malmo", "malmö", "uppsala", "lund", "linkoping", "linköping",
        "kth", "chalmers", "université de stockholm", "université de lund",
    ),
    PaysEtudes.NORVEGE: (
        "norvege", "norvège", "norway", "norvégien", "norvegien", "oslo", "bergen",
        "trondheim", "stavanger", "tromso", "tromsø", "ntnu", "université d'oslo",
    ),
    PaysEtudes.FINLANDE: (
        "finlande", "finland", "finlandais", "finlandais", "helsinki", "espoo",
        "tampere", "turku", "oulu", "aalto", "université d'helsinki",
        "université d'aalto",
    ),
    PaysEtudes.DANEMARK: (
        "danemark", "denmark", "danois", "copenhague", "copenhagen", "aarhus",
        "odense", "aalborg", "université de copenhague", "dtu", "université d'aarhus",
    ),
    PaysEtudes.AUTRICHE: (
        "autriche", "austria", "autrichien", "vienna", "vienne", "graz", "linz",
        "salzburg", "innsbruck", "université de vienne", "tu wien", "université de graz",
    ),
    PaysEtudes.IRLANDE: (
        "irlande", "ireland", "irlandais", "dublin", "cork", "galway", "limerick",
        "waterford", "trinity college", "ucd", "université de dublin", "dcu",
    ),
    PaysEtudes.PORTUGAL: (
        "portugal", "portugais", "lisbonne", "lisbon", "porto", "coimbra",
        "braga", "aveiro", "université de lisbonne", "université de porto",
        "université de coimbra",
    ),
    PaysEtudes.GRECE: (
        "grece", "grèce", "greece", "grec", "athenes", "athènes", "thessalonique",
        "patras", "heraklion", "larissa", "volos", "université d'athènes",
        "université aristote",
    ),
    PaysEtudes.POLOGNE: (
        "pologne", "poland", "polonais", "warsaw", "varsovie", "krakow", "cracovie",
        "lodz", "wroclaw", "poznan", "gdansk", "szczecin", "université de varsovie",
        "université jagellonne", "polytechnique de varsovie",
    ),
    PaysEtudes.TURQUIE: (
        "turquie", "turkey", "turc", "istanbul", "ankara", "izmir", "bursa",
        "antalya", "adana", "konya", "gaziantep", "kocaeli", "sabanci",
        "koc", "boun", "metu", "odtu", "boğaziçi", "bogazici",
    ),
    # Maghreb / Afrique
    PaysEtudes.MAROC: (
        "maroc", "morocco", "marocain", "marocaine", "rabat", "casablanca",
        "marrakech", "marrakesh", "fes", "fès", "tanger", "tangier", "agadir",
        "meknes", "oujda", "kenitra", "tetouan", "tétouan", "safi", "el jadida",
        "université mohammed v", "université cadi ayyad", "université hassan ii",
        "emi", "enim", "insa rabat", "uir", "universite mohammed 6",
    ),
    PaysEtudes.TUNISIE: (
        "tunisie", "tunisia", "tunisien", "tunisienne", "tunis", "sfax", "sousse",
        "kairouan", "bizerte", "gabes", "gàbes", "nabeul", "monastir", "mahdia",
        "université de tunis", "université de sfax", "université de sousse",
        "insat", "enis", "esprit", "esat",
    ),
    PaysEtudes.ALGERIE: (
        "algerie", "algérie", "algeria", "algerien", "algérien", "alger",
        "oran", "constantine", "annaba", "batna", "blida", "setif", "sétif",
        "tizi ouzou", "bejaia", "béjaïa", "skikda", "tlemcen", "mostaganem",
        "université d'alger", "université d'oran", "université de constantine",
        "usthb", "esi", "enp", "enstp",
    ),
    PaysEtudes.SENEGAL: (
        "senegal", "sénégal", "senegalais", "sénégalais", "dakar", "thies",
        "thiès", "kaolack", "saint-louis", "ziguinchor", "diourbel", "louga",
        "tambacounda", "matam", "kedougou", "kédougou", "kolda", "sedhiou",
        "sédhiou", "ucad", "université cheikh anta diop", "université gaston berger",
        "université assane seck", "université alioune diop", "esmt", "isep",
    ),
    PaysEtudes.COTE_IVOIRE: (
        "cote d'ivoire", "côte d'ivoire", "ivoire", "ivory coast", "abidjan",
        "bouake", "bouaké", "daloa", "yamoussoukro", "korhogo", "san pedro",
        "san-pedro", "man", "guiglo", "abengourou", "bondoukou", "ferkessedougou",
        "université felix houphouet", "université nangui abrogoua", "université alassane",
        "insa abidjan", "ensta abidjan",
    ),
    # Destinations hors Europe/Afrique de l'Ouest. Ajoutées le 27/10/2026 après
    # mesure : ce sont les pays que les AGRÉGATEURS publient le plus (MEXT Japon,
    # bourses chinoises/CSC, KGSP Corée, ICCR Inde, Mastercard Foundation en
    # Afrique du Sud, Melbourne/Sydney, KAUST, Qatar…). Sans elles, ces offres
    # tombaient dans `autre` : visibles, mais infiltrables nulle part par pays.
    PaysEtudes.JAPON: (
        "japon", "japan", "japanese", "japonais", "japonaise", "tokyo", "kyoto",
        "osaka", "nagoya", "sendai", "fukuoka", "hokkaido", "tsukuba", "mext",
        "tobitate", "jsps", "université de tokyo",
    ),
    PaysEtudes.CHINE: (
        "chine", "china", "chinese", "chinois", "chinoise", "pekin", "pékin",
        "beijing", "shanghai", "guangzhou", "wuhan", "hangzhou", "nanjing",
        "tsinghua", "peking university", "fudan", "zhejiang", "csc scholarship",
        "confucius", "chinese government scholarship",
    ),
    PaysEtudes.COREE_SUD: (
        "coree du sud", "corée du sud", "south korea", "korea", "coreen", "coréen",
        "seoul", "séoul", "busan", "kaist", "kgsp", "yonsei", "snu",
        "seoul national university", "daejin",
    ),
    PaysEtudes.INDE: (
        "inde", "india", "indien", "indienne", "delhi", "mumbai", "bangalore",
        "chennai", "kolkata", "hyderabad", "pune", "iccr", "iit", "iim",
        "indian institute of technology",
    ),
    PaysEtudes.AFRIQUE_DU_SUD: (
        "afrique du sud", "south africa", "south african", "sud-africain",
        "pretoria", "johannesburg", "cape town", "le cap", "durban",
        "stellenbosch", "witwatersrand", "wits", "university of cape town",
        "rhodes university", "nelson mandela university",
    ),
    PaysEtudes.AUSTRALIE: (
        "australie", "australia", "australian", "australien", "melbourne",
        "sydney", "canberra", "brisbane", "adelaide", "perth", "monash",
        "unsw", "university of queensland", "anu",
    ),
    PaysEtudes.NOUVELLE_ZELANDE: (
        "nouvelle-zelande", "nouvelle zélande", "new zealand", "auckland",
        "wellington", "christchurch", "otago", "victoria university of wellington",
    ),
    PaysEtudes.RUSSIE: (
        "russie", "russia", "russian", "russe", "moscou", "moscow",
        "saint-petersbourg", "saint petersburg", "bauman", "open doors",
        "russian government scholarship",
    ),
    PaysEtudes.QATAR: (
        "qatar", "doha", "hamad bin khalifa", "doha institute",
    ),
    PaysEtudes.ARABIE_SAOUDITE: (
        "arabie saoudite", "saudi arabia", "saudi", "saoudien", "riyad", "riyadh",
        "jeddah", "kaust", "king abdullah university",
    ),
    PaysEtudes.EGYPTE: (
        "egypte", "egypt", "egyptien", "égyptien", "le caire", "cairo",
        "al azhar", "australian university in egypt",
    ),
    PaysEtudes.BRESIL: (
        "bresil", "brésil", "brazil", "brazilian", "bresilien", "brésilien",
        "sao paulo", "são paulo", "rio de janeiro", "brasilia", "unicamp", "usp",
    ),
    PaysEtudes.MEXIQUE: (
        "mexique", "mexico", "mexican", "mexicain", "unam", "monterrey",
        "guadalajara", "puebla", "tec de monterrey",
    ),
}


def _normaliser_texte(texte: str) -> str:
    """Normalise pour recherche : minuscules, accents supprimés, espaces unifiés."""
    if not texte:
        return ""
    t = texte.lower()
    # Remplacer les accents courants
    remplacements = {
        "é": "e", "è": "e", "ê": "e", "ë": "e",
        "à": "a", "â": "a", "ä": "a",
        "î": "i", "ï": "i",
        "ô": "o", "ö": "o",
        "ù": "u", "û": "u", "ü": "u",
        "ç": "c",
        "ñ": "n",
    }
    for a, b in remplacements.items():
        t = t.replace(a, b)
    # Unifier espaces et ponctuation
    t = re.sub(r"[\s\-_]+", " ", t)
    return t.strip()


def _pays_correspondants(texte_normalise: str) -> list[PaysEtudes]:
    """Tous les pays dont un mot-clé apparaît (frontière de mot stricte).

    Frontière obligatoire : sans elle « machine learning » contenait « chine »
    et « independent » contenait « inde » (faux positifs mesurés le 27/10/2026
    sur la sonde de contrôle).
    """
    trouves: list[PaysEtudes] = []
    for pays_enum, mots_cles in PAYS_MOTS_CLES.items():
        for mot in mots_cles:
            mot_norm = _normaliser_texte(mot)
            if not mot_norm:
                continue
            if re.search(rf"(?<!\w){re.escape(mot_norm)}(?!\w)", texte_normalise):
                trouves.append(pays_enum)
                break  # Un mot-clé suffit pour ce pays
    return trouves


def pays_depuis_texte(
    titre: str,
    description: str,
    url: str = "",
) -> Optional[PaysEtudes]:
    """Détecte le pays d'études depuis le texte (titre + description + URL).

    Args:
        titre: Titre de l'offre
        description: Description de l'offre
        url: URL source (optionnel, utilisé comme dernier recours)

    Returns:
        PaysEtudes si détection non ambiguë, None sinon (jamais deviné).
    """
    # Concaténer et normaliser
    texte_complet = _normaliser_texte(f"{titre} {description} {url}")

    if not texte_complet.strip():
        return None

    # 1. LE TITRE FAIT FOI quand il ne nomme qu'UN pays. La description des
    #    agrégateurs cite souvent d'autres pays (« compare with USA, UK… ») :
    #    l'ancienne règle « plusieurs pays = ambigu = None » faisait perdre
    #    25 offres dont le titre nommait pourtant le pays sans ambiguïté
    #    (mesure du 27/10/2026). Un titre explicite n'est pas une ambiguïté.
    pays_du_titre = _pays_correspondants(_normaliser_texte(titre))
    if len(pays_du_titre) == 1:
        return pays_du_titre[0]

    # 2. Sinon, texte complet — et seulement s'il reste non ambigu.
    correspondances = _pays_correspondants(texte_complet)

    # Si exactement une correspondance → retour
    if len(correspondances) == 1:
        return correspondances[0]

    # Si plusieurs ou zéro → ambigu ou absent → None (jamais deviné)
    return None
