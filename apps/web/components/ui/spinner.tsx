/**
 * Spinner unique — source de vérité des états de chargement.
 *
 * Avant : 4 copies ad hoc de `animate-spin rounded-full border-2 border-signature`
 * (constat chasse 0 · B4). Une seule définition garantit le même rendu partout et
 * un seul endroit à corriger.
 *
 * `motion-reduce:animate-none` : en `prefers-reduced-motion`, le cercle reste
 * visible mais figé (pas de rotation perpétuelle).
 */
export function Spinner({
  className = "h-6 w-6",
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
      className={`${className} motion-reduce:animate-none animate-spin rounded-full border-2 border-signature border-t-transparent`}
    />
  );
}
