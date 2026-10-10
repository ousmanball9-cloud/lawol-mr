"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Calendar,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
  X,
} from "lucide-react";

/** Champs de l'offre exposés par GET /api/v1/matches (voir docs/brief-offre-detail.md). */
export type OffreDetail = {
  id: string;
  titre: string;
  entreprise: string;
  ville: string;
  type_offre: string;
  date_limite: string;
  description: string;
  contact_email?: string | null;
  contact_whatsapp?: string | null;
  source_url?: string | null;
  source_name?: string | null;
  filieres_cibles?: string[];
};

export const TYPES_OFFRES: Record<string, string> = {
  stage_pfe: "Stage PFE",
  stage_ete: "Stage été",
  emploi_junior: "Emploi junior",
  alternance: "Alternance",
  bourse: "Bourse d'études",
};

/**
 * Tenue des badges type d'offre : version épurée (petites capitales + bordure
 * fine neutre). Une seule et même tenue pour les 5 types — zéro rainbow.
 * La classe `badge-offre` sert de sonde de mesure (scripts/verify-design.mjs).
 */
const BADGE_OFFRE_NEUTRE = "border border-border bg-muted text-muted-foreground";

export const BADGES_TYPE: Record<string, string> = {
  stage_pfe: BADGE_OFFRE_NEUTRE,
  emploi_junior: BADGE_OFFRE_NEUTRE,
  bourse: BADGE_OFFRE_NEUTRE,
  stage_ete: BADGE_OFFRE_NEUTRE,
  alternance: BADGE_OFFRE_NEUTRE,
};

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Parse une date_limite backend : ISO « 2026-11-30 » ou française « 30/11/2026 ». */
function parserDateLimite(valeur: string): Date | null {
  const brut = valeur?.trim() ?? "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(brut);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const fr = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(brut);
  if (fr) return new Date(Number(fr[3]), Number(fr[2]) - 1, Number(fr[1]));
  return null;
}

/** Jours restants en jours calendaires (0 = jour même de date_limite, négatif = dépassé). */
function joursRestants(date: Date | null): number | null {
  if (!date) return null;
  const maintenant = new Date();
  const debutAujourdhui = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const jourLimite = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((jourLimite.getTime() - debutAujourdhui.getTime()) / 86_400_000);
}

/** Nettoie un numéro mauritanien pour wa.me : chiffres seulement, préfixe 222 si besoin. */
function lienWhatsApp(brut: string): string {
  let numero = brut.replace(/\D/g, "");
  if (numero.startsWith("00222")) numero = numero.slice(2);
  else if (!numero.startsWith("222")) numero = `222${numero}`;
  return `https://wa.me/${numero}`;
}

/** Garde uniquement les URL http(s) (anti javascript: injecté). */
function lienSecurise(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

/* ---------- Organisation du texte de l'offre (le « brief » scrapé) ---------- */

type BlocDescription =
  | { type: "infos"; items: { cle: string; valeur: string }[] }
  | { type: "liste"; items: string[] }
  | { type: "para"; texte: string };

const RE_LIGNE_LISTE = /^\s*(?:[-–—•◦*]|\d{1,2}[.)])\s+(.+)$/;
const RE_INFO_LIGNE = /^([A-Za-zÀ-ÿ][^:\n]{1,40})\s*:\s*(\S[^:]{0,110})$/;
/** « Date de clôture : 15 November 2026. Applications are open… » — une paire
 * en tête suivie d'une vraie prose : la paire monte en grille, le reste en
 * paragraphe (sinon l'info clé se noie dans un mur de texte). */
const RE_PAIRE_TETE = /^([A-Za-zÀ-ÿ][^:\n]{1,40})\s*:\s*([^:.]{1,110})\.\s+(.+)$/;

/** « Niveau : X. Couverture : Y. » (une ligne, plusieurs paires) → paires, sinon null.
 * `depassement` = paires au-delà de la 12ᵉ, rendues en prose — jamais jetées. */
function decouperLigneComposee(
  ligne: string
): { intro: string | null; items: { cle: string; valeur: string }[]; depassement: string | null } | null {
  const segments = ligne.split(/\.\s+(?=[^:\n]{2,40}\s*:\s*)/);
  if (segments.length < 2) return null;
  const items: { cle: string; valeur: string }[] = [];
  let intro: string | null = null;
  for (let i = 0; i < segments.length; i++) {
    const morceau = segments[i].trim().replace(/\.$/, "");
    const m = RE_INFO_LIGNE.exec(morceau);
    if (m) {
      items.push({ cle: m[1].trim(), valeur: m[2].trim() });
    } else if (i === 0 && morceau.length <= 160) {
      intro = morceau; // phrase d'accroche avant la série de paires
    } else {
      return null; // vraie prose → on garde le paragraphe tel quel
    }
  }
  if (items.length < 2) return null;
  const dep = items.slice(12);
  return {
    intro,
    items: items.slice(0, 12),
    depassement: dep.length ? dep.map((p) => `${p.cle} : ${p.valeur}`).join(". ") : null,
  };
}

/** Un paragraphe >380 car. devient un mur de texte : on le découpe en
 * groupes de phrases (aucun mot perdu — la somme = le texte d'origine). */
const TAILLE_PARA_MAX = 380;
function decouperPara(texte: string): string[] {
  if (texte.length <= TAILLE_PARA_MAX) return [texte];
  const phrases = texte.match(/[^.!?…]+[.!?…]+[»\s]*|[^.!?…]+$/g) ?? [texte];
  const morceaux: string[] = [];
  const pousser = (t: string) => {
    // phrase elle-même trop longue → découpe dure par mots (secours)
    if (t.length <= TAILLE_PARA_MAX) {
      morceaux.push(t);
      return;
    }
    const mots = t.split(" ");
    let bout = "";
    for (const mot of mots) {
      if (bout && (bout + " " + mot).length > TAILLE_PARA_MAX) {
        morceaux.push(bout);
        bout = mot;
      } else {
        bout = bout ? `${bout} ${mot}` : mot;
      }
    }
    if (bout) morceaux.push(bout);
  };
  let actuel = "";
  for (const p of phrases) {
    if (actuel && (actuel + p).length > TAILLE_PARA_MAX) {
      pousser(actuel.trim());
      actuel = p;
    } else {
      actuel += p;
    }
  }
  if (actuel.trim()) pousser(actuel.trim());
  return morceaux.length ? morceaux : [texte];
}

/** « Date limite : 29 octobre 2026 Lieu : Nouakchott … » — paires séparées
 * par des espaces (nettoyage beta) : Mot-capital-suivi-de-deux-points = frontière,
 * puis extraction de la paire en tête de chaque morceau (le reste est conservé). */
function decouperPairesEspace(
  ligne: string
): { items: { cle: string; valeur: string }[]; reste: string } | null {
  const morceaux = ligne.split(/(?<=\s)(?=[A-ZÀ-Ý][\wà-ÿ]{1,15}\s*:\s*\S)/);
  if (morceaux.length < 2) return null;
  const items: { cle: string; valeur: string }[] = [];
  const reste: string[] = [];
  for (const m of morceaux) {
    const t = m.trim();
    const mi = /^([A-Za-zÀ-ÿ][^:]{1,40})\s*:\s*([^:.]{1,110}?)(?:\s*\.\s*|$)([\s\S]*)$/.exec(t);
    if (mi && mi[1].trim().length >= 2) {
      items.push({ cle: mi[1].trim(), valeur: mi[2].trim() });
      if (mi[3].trim()) reste.push(mi[3].trim());
    } else {
      reste.push(t);
    }
  }
  return items.length >= 2 ? { items, reste: reste.filter(Boolean).join(" ") } : null;
}

/**
 * Découpe le texte scrapé en blocs lisibles : paires clé/valeur (grid),
 * listes à puces, paragraphes. Aucun mot n'est perdu (textContent identique),
 * aucun lien n'est fabriqué — lisible quel que soit le désordre de la source.
 */
export function formaterDescription(brut: string): BlocDescription[] {
  const propre = brut
    .replace(/<[^>]+>/g, " ") // anti-HTML injecté
    .replace(/[\u00a0\u200b]/g, " ")
    .replace(/\r\n?/g, "\n");
  const lignes = propre.split("\n").map((l) => l.replace(/\s+/g, " ").trim());

  const blocs: BlocDescription[] = [];
  let para: string[] = [];
  let liste: string[] = [];
  let infos: { cle: string; valeur: string }[] = [];

  const viderPara = () => {
    if (para.length) {
      for (const morceau of decouperPara(para.join(" "))) {
        blocs.push({ type: "para", texte: morceau });
      }
      para = [];
    }
  };
  const viderListe = () => {
    if (liste.length) {
      blocs.push({ type: "liste", items: liste });
      liste = [];
    }
  };
  const viderInfos = () => {
    if (infos.length) {
      blocs.push({ type: "infos", items: infos });
      infos = [];
    }
  };
  const viderTout = () => {
    // Invariant : la grille d'infos se vide AVANT son paragraphe d'explication
    // (ordre de lecture : « Date de clôture : X » puis la prose qui suit).
    viderListe();
    viderInfos();
    viderPara();
  };

  for (const ligne of lignes) {
    if (!ligne) {
      viderTout(); // ligne vide = vrai séparateur de bloc
      continue;
    }
    const ml = RE_LIGNE_LISTE.exec(ligne);
    if (ml) {
      viderInfos();
      viderPara();
      liste.push(ml[1].trim());
      continue;
    }
    const mi = RE_INFO_LIGNE.exec(ligne);
    if (mi && infos.length < 12) {
      viderPara();
      viderListe();
      infos.push({ cle: mi[1].trim(), valeur: mi[2].trim() });
      continue;
    }
    // Ligne prose : tente la version composée (« Niveau : X. Couverture : Y. »)
    const composee = decouperLigneComposee(ligne);
    if (composee) {
      viderListe();
      viderInfos();
      viderPara();
      if (composee.intro) {
        blocs.push({ type: "para", texte: composee.intro });
      }
      infos.push(...composee.items);
      if (composee.depassement) para.push(composee.depassement);
      continue;
    }
    // Paire en tête + prose longue (« Date de clôture : X. Applications… »)
    const mp = RE_PAIRE_TETE.exec(ligne);
    if (mp && infos.length < 12) {
      viderListe();
      viderInfos();
      viderPara();
      infos.push({ cle: mp[1].trim(), valeur: mp[2].trim() });
      if (mp[3].trim()) para.push(mp[3].trim());
      continue;
    }
    // Paires séparées par espaces (« Date limite : X Lieu : Y … » — nettoyage beta)
    const paires = decouperPairesEspace(ligne);
    if (paires && infos.length + paires.items.length <= 12) {
      viderListe();
      viderInfos();
      viderPara();
      infos.push(...paires.items);
      if (paires.reste) para.push(paires.reste);
      continue;
    }
    viderListe();
    viderInfos();
    para.push(ligne);
  }
  viderTout();
  return blocs;
}

/** Libellés des statuts de candidature (valeurs enum backend StatutCandidature). */
export const STATUTS: Record<string, string> = {
  postule: "Postulé",
  en_cours: "En cours",
  reponse_recue: "Réponse reçue",
  entretien: "Entretien",
  accepte: "Accepté",
  refuse: "Refusé",
};

type Props = {
  offre: OffreDetail;
  postule: boolean;
  /** Statut courant du suivi (null = non renseigné, affiché « Postulé »). */
  statut: string | null;
  enCours: boolean;
  onPostuler: () => void;
  onStatut: (valeur: string) => void;
  onFermer: () => void;
};

/**
 * Vue détail d'une offre (modale légère, sans dépendance).
 * Fermeture : bouton ✕ + clic sur le fond + touche Échap.
 */
export function OffreDetailModal({ offre, postule, statut, enCours, onPostuler, onStatut, onFermer }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onFermer();
    }
    document.addEventListener("keydown", onKey);
    const overflowPrec = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // pas de scroll de la page derrière
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflowPrec;
    };
  }, [onFermer]);

  const date = parserDateLimite(offre.date_limite);
  const jours = joursRestants(date);
  const filieres = offre.filieres_cibles ?? [];
  const email = offre.contact_email?.trim() || null;
  const whatsapp = offre.contact_whatsapp?.trim() || null;
  const lienSource = offre.source_url?.trim() ? lienSecurise(offre.source_url.trim()) : null;
  const aUnCanal = Boolean(email || whatsapp || lienSource);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onFermer}
      aria-hidden="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Détail de l'offre ${offre.titre}`}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[85vh] w-full max-w-lg sm:max-w-xl overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-[0_24px_48px_-12px_rgba(10,10,10,0.28)]"
      >
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer le détail de l'offre"
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signature/60"
        >
          <X className="h-4 w-4" />
        </button>

        {/* 1. Badge type + titre */}
        <span
          className={`badge-offre inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${
            BADGES_TYPE[offre.type_offre] ?? BADGE_OFFRE_NEUTRE
          }`}
        >
          {TYPES_OFFRES[offre.type_offre] || offre.type_offre}
        </span>
        <h2 className="mt-3 pr-8 font-display text-xl font-bold leading-snug tracking-[-0.01em] text-foreground">{offre.titre}</h2>

        {/* 2. Entreprise + ville + source */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4" />
            {offre.entreprise}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            {offre.ville}
          </span>
          {offre.source_name && <span className="flex items-center gap-1.5">Source : {offre.source_name}</span>}
        </div>

        {/* 3. Date limite en clair + compte à rebours */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {date ? `Avant le ${DATE_FORMAT.format(date)}` : `Date limite : ${offre.date_limite}`}
          </span>
          {jours !== null &&
            (jours < 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                Clôturée
              </span>
            ) : jours === 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                Dernier jour
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">
                <Clock className="h-3 w-3" />
                J-{jours}
              </span>
            ))}
        </div>

        {/* 4. Description organisée : paires clé/valeur, listes, paragraphes */}
        {offre.description && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Description</h3>
            <div className="space-y-3">
              {formaterDescription(offre.description).map((bloc, i) => {
                if (bloc.type === "infos") {
                  return (
                    <dl
                      key={i}
                      data-probe="desc-infos"
                      className="grid grid-cols-1 gap-x-6 gap-y-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3 sm:grid-cols-2"
                    >
                      {bloc.items.map((item) => (
                        <div key={item.cle} className="flex flex-col">
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                            {item.cle}
                          </dt>
                          <dd className="text-sm text-foreground">{item.valeur}</dd>
                        </div>
                      ))}
                    </dl>
                  );
                }
                if (bloc.type === "liste") {
                  return (
                    <ul
                      key={i}
                      data-probe="desc-liste"
                      className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground/80"
                    >
                      {bloc.items.map((item, j) => (
                        <li key={j}>{item}</li>
                      ))}
                    </ul>
                  );
                }
                return (
                  <p key={i} data-probe="desc-para" className="text-sm leading-relaxed text-foreground/80">
                    {bloc.texte}
                  </p>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. Filières cibles */}
        {filieres.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Filières cibles</h3>
            <div className="flex flex-wrap gap-2">
              {filieres.map((filiere) => (
                <span
                  key={filiere}
                  className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-semibold capitalize text-muted-foreground"
                >
                  {filiere.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 6. Comment postuler */}
        <div className="mt-5 rounded-lg border border-border bg-muted/50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Comment postuler</h3>
          {aUnCanal ? (
            <div className="flex flex-col gap-2">
              {email && (
                <a
                  href={`mailto:${email}?subject=${encodeURIComponent(`Candidature — ${offre.titre}`)}`}
                  className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:border-signature hover:text-signature"
                >
                  <Mail className="h-4 w-4 shrink-0 text-signature" />
                  Postuler par e-mail
                </a>
              )}
              {whatsapp && (
                <a
                  href={lienWhatsApp(whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:border-signature hover:text-signature"
                >
                  <MessageCircle className="h-4 w-4 shrink-0 text-signature" />
                  Écrire sur WhatsApp
                </a>
              )}
              {lienSource && (
                <a
                  href={lienSource}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:border-signature hover:text-signature"
                >
                  <ExternalLink className="h-4 w-4 shrink-0 text-signature" />
                  Voir l&apos;offre originale
                  {offre.source_name ? ` — ${offre.source_name}` : ""}
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun canal de candidature indiqué — cherche l&apos;entreprise sur Google ou LinkedIn.
            </p>
          )}
        </div>

        {/* 7. J'ai postulé */}
        <Button
          onClick={onPostuler}
          disabled={postule || enCours}
          className="mt-5 h-11 w-full rounded-lg bg-signature text-white hover:bg-signature-deep"
        >
          {postule ? "Postulé ✅" : enCours ? "Enregistrement..." : "J'ai postulé"}
        </Button>

        {/* 8. Suivi de candidature — option avancée (Hick) : cachée tant que non postulée */}
        {postule && (
          <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4">
            <label htmlFor="suivi-statut" className="mb-2 block text-sm font-semibold text-foreground">
              Suivi de ta candidature
            </label>
            <select
              id="suivi-statut"
              value={statut ?? "postule"}
              onChange={(e) => onStatut(e.target.value)}
              aria-label="Suivi de ta candidature"
              data-probe="statut"
              className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground transition-colors duration-150 focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30"
            >
              {Object.entries(STATUTS).map(([valeur, libelle]) => (
                <option key={valeur} value={valeur}>
                  {libelle}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
