import { formaterDescription } from "@/components/offre-detail-modal";

/**
 * Rendu de la description organisée — même découpage que la modale détail
 * (paires clé/valeur en grille, listes à puces, paragraphes).
 */
export function BlocDescription({ description }: { description: string }) {
  return (
    <div className="space-y-3">
      {formaterDescription(description).map((bloc, i) => {
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
  );
}
