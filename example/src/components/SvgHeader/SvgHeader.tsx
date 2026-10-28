import { LOGOTYPE_VIEWBOX, logotype } from "./logotype";

type SvgHeaderProps = {
  className?: string;
};

export function SvgHeader({ className }: SvgHeaderProps) {
  return (
    <svg
      viewBox={LOGOTYPE_VIEWBOX}
      className={className}
      role="img"
      aria-label="Bueno /Screen-Demo"
    >
      <path d={logotype} fill="currentColor" />
    </svg>
  );
}
