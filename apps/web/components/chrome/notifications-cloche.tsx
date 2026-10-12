"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Check, Clock, Sparkles } from "lucide-react";
import { lireTokenSession } from "@/lib/session";

/** Cloche de notifications (header) — contrat imposé du centre d'alertes :
 *   GET  /api/v1/profils/{tel}/notifications → { notifications: [...] }
 *   POST /api/v1/profils/{tel}/notifications/lues → { ids: [...] } → { lues: n }
 * Le Bearer est injecté par le middleware Next sur /api/v1/profils/*.
 *
 * Grâce totale : sans session (cookie `lawol_token` absent) ou si le premier
 * GET échoue → le composant rend `null` (aucune cloche fantôme). Un seul fetch
 * au montage + un re-fetch à chaque ouverture du panneau — jamais de boucle.
 * Charte « Nuit d'Indigo » : tokens existants uniquement (bg-card, border-border,
 * text-ink, text-signature, bg-nuit, ambre déjà utilisé par BadgeEcheance).
 */

type TypeNotification = "nouveau_match" | "echeance";

type Notification = {
  id: string;
  type: TypeNotification;
  titre: string;
  texte: string;
  date: string;
  lien: string;
  lue: boolean;
};

const LIBELLES_TYPE: Record<TypeNotification, string> = {
  nouveau_match: "Nouvelle bourse",
  echeance: "Échéance",
};

/** Téléphone porté par le payload (base64url) du token de session, sinon null. */
function lireTelephoneSession(): string | null {
  const token = lireTokenSession();
  if (!token) return null;
  const payload = token.split(".")[0];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const donnees = JSON.parse(json) as { tel?: unknown };
    return typeof donnees.tel === "string" && donnees.tel ? donnees.tel : null;
  } catch {
    return null;
  }
}

/** Date relative simple en français (« il y a 2 jours »), null si imparsable. */
function dateRelative(iso: string): string | null {
  const horodatage = Date.parse(iso);
  if (Number.isNaN(horodatage)) return null;
  const secondes = Math.max(0, Math.floor((Date.now() - horodatage) / 1000));
  if (secondes < 60) return "à l'instant";
  const minutes = Math.floor(secondes / 60);
  if (minutes < 60) return `il y a ${minutes} min${minutes > 1 ? "s" : ""}`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  if (jours === 1) return "hier";
  if (jours < 7) return `il y a ${jours} jours`;
  const semaines = Math.floor(jours / 7);
  if (semaines < 5) return `il y a ${semaines} semaine${semaines > 1 ? "s" : ""}`;
  const mois = Math.floor(jours / 30);
  if (mois < 12) return `il y a ${mois} mois`;
  const annees = Math.floor(jours / 365);
  return `il y a ${annees} an${annees > 1 ? "s" : ""}`;
}

/** Defensive : une entrée mal formée est écartée, jamais un crash. */
function normaliserNotification(brut: unknown): Notification | null {
  if (typeof brut !== "object" || brut === null) return null;
  const n = brut as Record<string, unknown>;
  const id =
    typeof n.id === "string" && n.id
      ? n.id
      : typeof n.id === "number"
        ? String(n.id)
        : null;
  if (!id) return null;
  return {
    id,
    type: n.type === "echeance" ? "echeance" : "nouveau_match",
    titre: typeof n.titre === "string" ? n.titre : "",
    texte: typeof n.texte === "string" ? n.texte : "",
    date: typeof n.date === "string" ? n.date : "",
    lien: typeof n.lien === "string" ? n.lien : "",
    lue: n.lue === true,
  };
}

export function NotificationsCloche() {
  const [telephone, setTelephone] = useState<string | null>(null);
  const [liste, setListe] = useState<Notification[] | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Ids dont le POST « lues » est en cours : gardés lus même si un re-fetch
  // revient avec l'ancien état serveur (évite le clignotement non-lu → lu).
  const marquagesRef = useRef<Set<string>>(new Set());
  const zoneRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  /** GET des notifications — un seul appel par ouverture, annulable au démontage. */
  const charger = useCallback(async (tel: string) => {
    abortRef.current?.abort();
    const controleur = new AbortController();
    abortRef.current = controleur;
    try {
      const res = await fetch(`/api/v1/profils/${tel}/notifications`, {
        cache: "no-store",
        signal: controleur.signal,
      });
      if (!res.ok) throw new Error("notifications indisponibles");
      const data = (await res.json()) as { notifications?: unknown };
      if (!Array.isArray(data?.notifications)) throw new Error("payload inattendu");
      if (controleur.signal.aborted) return;
      const saines = data.notifications
        .map(normaliserNotification)
        .filter(Boolean) as Notification[];
      setListe(
        saines.map((n) =>
          marquagesRef.current.has(n.id) || n.lue ? { ...n, lue: true } : n
        )
      );
    } catch {
      // Échec silencieux : `liste` reste à son dernier état connu — si c'était
      // null (premier GET), le composant rend null. Jamais de crash, jamais de
      // re-boucle (aucun retry, seul le clic « ouvrir » re-fetche).
    }
  }, []);

  // Téléphone extrait du cookie au montage — sans session : rien à afficher.
  useEffect(() => {
    const tel = lireTelephoneSession();
    if (!tel) return;
    setTelephone(tel);
    void charger(tel);
    return () => abortRef.current?.abort();
  }, [charger]);

  // Fermeture à la navigation (changement de route).
  useEffect(() => {
    setOuvert(false);
  }, [pathname]);

  // Clic hors du panneau + Échap.
  useEffect(() => {
    if (!ouvert) return;
    const clicHors = (event: MouseEvent) => {
      if (zoneRef.current && !zoneRef.current.contains(event.target as Node)) {
        setOuvert(false);
      }
    };
    const echap = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOuvert(false);
    };
    document.addEventListener("mousedown", clicHors);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", clicHors);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);

  /** POST lues — optimiste (liste mise à jour tout de suite) + retour arrière
   * silencieux si le serveur refuse. */
  const marquerLues = async (ids: string[]) => {
    if (!telephone || ids.length === 0 || !liste) return;
    const avant = liste;
    ids.forEach((id) => marquagesRef.current.add(id));
    setListe(liste.map((n) => (ids.includes(n.id) ? { ...n, lue: true } : n)));
    try {
      const res = await fetch(`/api/v1/profils/${telephone}/notifications/lues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("marquage refusé");
      ids.forEach((id) => marquagesRef.current.delete(id));
    } catch {
      ids.forEach((id) => marquagesRef.current.delete(id));
      setListe(avant);
    }
  };

  // Pas de session, ou premier GET non abouti : la cloche n'existe pas.
  if (!telephone || liste === null) return null;

  const nonLues = liste.filter((n) => !n.lue).length;

  const basculer = () => {
    const suivant = !ouvert;
    setOuvert(suivant);
    if (suivant) void charger(telephone); // re-fetch à l'ouverture
  };

  return (
    <div ref={zoneRef} className="relative">
      <button
        type="button"
        onClick={basculer}
        aria-expanded={ouvert}
        aria-controls="panneau-notifications"
        aria-label={
          nonLues > 0 ? `Notifications, ${nonLues} non lue${nonLues > 1 ? "s" : ""}` : "Notifications"
        }
        className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors duration-150 hover:bg-muted"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {nonLues > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-background bg-signature px-1 text-[10px] font-semibold leading-none text-white"
          >
            {nonLues > 9 ? "9+" : nonLues}
          </span>
        )}
      </button>

      {ouvert && (
        <div
          id="panneau-notifications"
          className="absolute right-0 top-full mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card shadow-xl shadow-nuit/10"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            {nonLues > 0 && (
              <span className="text-xs text-muted-foreground">
                {nonLues} non lue{nonLues > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {liste.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Aucune notification pour le moment.
            </p>
          ) : (
            <ul className="max-h-[min(22rem,calc(100vh-8rem))] overflow-y-auto p-2">
              {liste.map((n) => {
                const cible =
                  n.lien.startsWith("/") || n.lien.startsWith("http") ? n.lien : null;
                const externe = cible?.startsWith("http") ?? false;
                const classeLigne = `flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 hover:bg-muted${
                  n.lue ? " opacity-70" : ""
                }`;
                const contenu = (
                  <>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span
                        className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          n.type === "echeance"
                            ? "border border-amber-200 bg-amber-50 text-amber-900"
                            : "bg-signature/10 text-signature"
                        }`}
                      >
                        {n.type === "echeance" ? (
                          <Clock className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <Sparkles className="h-3 w-3" aria-hidden="true" />
                        )}
                        {LIBELLES_TYPE[n.type]}
                      </span>
                      {n.titre && (
                        <span className="truncate text-sm font-medium text-foreground">{n.titre}</span>
                      )}
                      {n.texte && (
                        <span className="line-clamp-2 text-xs text-muted-foreground">{n.texte}</span>
                      )}
                      <span className="text-[11px] text-muted-foreground">{dateRelative(n.date)}</span>
                    </span>
                    {!n.lue && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-nuit" aria-hidden="true" />
                    )}
                  </>
                );
                return (
                  <li key={n.id}>
                    {cible ? (
                      <Link
                        href={cible}
                        onClick={() => void marquerLues([n.id])}
                        className={classeLigne}
                        {...(externe ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      >
                        {contenu}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void marquerLues([n.id])}
                        className={classeLigne}
                      >
                        {contenu}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {nonLues > 0 && (
            <div className="border-t border-border p-2">
              <button
                type="button"
                onClick={() => void marquerLues(liste.filter((n) => !n.lue).map((n) => n.id))}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-signature transition-colors duration-150 hover:bg-signature/10"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                Tout marquer comme lu
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
