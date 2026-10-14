"use client";

import type { SVGProps } from "react";

/**
 * Props du composant Sparkline.
 * @interface SparklineProps
 * @property {number[]} data - Données sur 8 semaines (ex: offres reçues par semaine).
 * @property {string} [color="currentColor"] - Couleur du trait (défaut: héritée via currentColor = text-signature).
 * @property {number} [height=60] - Hauteur du SVG en pixels.
 * @property {string} [className] - Classes Tailwind additionnelles.
 */
export interface SparklineProps extends Omit<SVGProps<SVGSVGElement>, "children" | "width" | "height"> {
  data: number[];
  color?: string;
  height?: number;
  className?: string;
}

/**
 * Calcule les points d'une courbe lisse (cubic Bézier simplifiée) normalisés 0-1.
 * @param data - Tableau de valeurs numériques.
 * @returns Chaîne de points "x,y x,y ..." pour <polyline>.
 */
function computeSmoothPoints(data: number[]): string {
  if (data.length < 2) return "";

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // éviter division par 0 si toutes valeurs égales

  const points: { x: number; y: number }[] = data.map((value, i) => ({
    x: i / (data.length - 1),
    y: 1 - (value - min) / range, // inversion Y (SVG origine en haut)
  }));

  // Construction d'un chemin lisse via catmull-rom → cubic bézier
  const pathParts: string[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[0];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || points[points.length - 1];

    // Tension 0.5 (catmull-rom standard)
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    if (i === 0) {
      pathParts.push(`${p1.x},${p1.y}`);
    }
    pathParts.push(`${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`);
  }

  return pathParts.join(" ");
}

/**
 * Sparkline — Courbe d'évolution sur 8 semaines.
 * - SVG responsive (width 100%, height fixe)
 * - Courbe lisse (cubic Bézier) via <polyline>
 * - Accessible : aria-hidden + role="img" + aria-label
 * - Data-probe pour tests automatisés
 * - Couleur via currentColor (héritée du parent, ex: text-signature)
 */
export default function Sparkline({
  data,
  color = "currentColor",
  height = 60,
  className,
  ...props
}: SparklineProps) {
  const points = computeSmoothPoints(data);
  const min = data.length ? Math.min(...data) : 0;
  const max = data.length ? Math.max(...data) : 0;

  return (
    <svg
      role="img"
      aria-hidden="true"
      aria-label="Évolution offres 8 semaines"
      data-probe="sparkline"
      data-testid="sparkline"
      viewBox={`0 0 ${data.length - 1 || 1} 1`}
      preserveAspectRatio="none"
      style={{ width: "100%", height, color }}
      className={className}
      {...props}
    >
      {data.length >= 2 && (
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={0.025}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      )}
      {/* Ligne de référence min/max (optionnelle, invisible par défaut) */}
      <defs>
        <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.8" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <title>Évolution sur 8 semaines : min {min}, max {max}</title>
    </svg>
  );
}