"use client";

/**
 * Props du composant KpiCard.
 * @interface KpiCardProps
 * @property {React.ReactNode} icon - Icône à afficher (ex: lucide-react).
 * @property {string} label - Libellé du KPI.
 * @property {string | number} value - Valeur principale affichée en grand.
 * @property {"up" | "down" | "neutral"} [trend] - Tendance optionnelle.
 * @property {string | number} [trendValue] - Valeur de la tendance (ex: "+12%").
 * @property {number} [delay=0] - Délai d'entrée en ms pour animation décalée.
 * @property {string} [className] - Classes Tailwind additionnelles.
 */
export interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  trendValue?: string | number;
  delay?: number;
  className?: string;
}

/**
 * KpiCard — Carte KPI animée à l'entrée.
 * - Animation CSS @keyframes kpi-enter (opacity 0→1, translateY 16px→0, 0.5s ease-out)
 * - Respecte prefers-reduced-motion (pas d'animation)
 * - Layout : icône (bg-signature/10 text-signature), label (text-muted-foreground),
 *   value (font-display text-3xl text-ink), trend (flèche + valeur, emerald-600/red-600)
 * - Fond bg-card border border-border rounded-lg p-4
 * - Data-probe pour tests automatisés
 */
export default function KpiCard({
  icon,
  label,
  value,
  trend,
  trendValue,
  delay = 0,
  className,
}: KpiCardProps) {
  const style = {
    animationDelay: `${delay}ms`,
  } as React.CSSProperties;

  return (
    <div
      data-probe="kpi-carte-anim"
      data-testid="kpi-carte-anim"
      className={`bg-card border border-border rounded-lg p-4 animate-kpi-enter ${className ?? ""}`}
      style={style}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-signature/10 text-signature">
            {icon}
          </div>
          <p className="text-sm text-muted-foreground truncate">{label}</p>
          <p className="font-display text-3xl font-semibold text-ink truncate">
            {value}
          </p>
        </div>
        {trend && trendValue !== undefined && (
          <div
            className={`flex flex-col items-end gap-0.5 shrink-0 ${
              trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-600" : "text-muted-foreground"
            }`}
          >
            <span className="flex items-center gap-1 text-sm font-medium">
              {trend === "up" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 15l-6-6-6 6" />
                </svg>
              )}
              {trend === "down" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              )}
              {trend === "neutral" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14" />
                </svg>
              )}
              {trendValue}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}