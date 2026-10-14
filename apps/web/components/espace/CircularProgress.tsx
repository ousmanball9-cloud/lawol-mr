"use client";

import { useEffect, useState } from "react";

/**
 * Props du composant CircularProgress.
 * @interface CircularProgressProps
 * @property {number} value - Valeur de progression (0-100).
 * @property {number} [size=80] - Diamètre du cercle en pixels.
 * @property {number} [strokeWidth=8] - Épaisseur du trait en pixels.
 * @property {string} [label] - Libellé pour aria-label et affichage central.
 * @property {string} [className] - Classes Tailwind additionnelles.
 */
export interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

/**
 * CircularProgress — Jauge circulaire animée.
 * - SVG <circle> avec stroke-dasharray/dashoffset animé via CSS variable
 * - Animation CSS via transition sur --progress-offset (1s ease-out)
 * - Respecte prefers-reduced-motion (transition désactivée)
 * - Accessible : role="progressbar", aria-valuenow/min/max, aria-label
 * - Couleurs : track = border-border, progress = text-signature (via currentColor)
 * - Label central : valeur + "%" (font-display, text-ink)
 * - Data-probe pour tests automatisés
 */
export default function CircularProgress({
  value,
  size = 80,
  strokeWidth = 8,
  label = "Progression",
  className,
}: CircularProgressProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (clampedValue / 100) * circumference;

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Déclencher l'animation au montage (après le premier render pour que la transition parte de circumference)
  useEffect(() => {
    if (!prefersReducedMotion) {
      requestAnimationFrame(() => {
        setAnimate(true);
      });
    } else {
      setAnimate(true);
    }
  }, [prefersReducedMotion, clampedValue]);

  const currentOffset = animate ? targetOffset : circumference;

  return (
    <div
      className={`inline-flex flex-col items-center gap-2 ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <svg
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        data-probe="jauge-circulaire"
        data-testid="jauge-circulaire"
        className="transform -rotate-90"
        style={{ width: size, height: size }}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Track (fond) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={strokeWidth}
        />
        {/* Progress (animate via CSS transition on stroke-dashoffset) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={currentOffset}
          className="text-signature"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: currentOffset,
            transition: prefersReducedMotion
              ? "none"
              : "stroke-dashoffset 1s cubic-bezier(0.22, 0.61, 0.36, 1)",
          }}
        />
      </svg>
      <span className="font-display text-ink text-lg font-semibold">
        {clampedValue}<span className="text-sm font-normal">%</span>
      </span>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
}