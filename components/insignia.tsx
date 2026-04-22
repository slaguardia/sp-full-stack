/**
 * Playful military-manufacturing SVG insignia.
 * Colors are driven by `currentColor` so they follow surrounding text color.
 */

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

function prep({ size = 28, ...rest }: IconProps) {
  return {
    width: rest.width ?? size,
    height: rest.height ?? size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
}

/* --- Vehicles -------------------------------------------------------- */

export function TankIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 64 36" {...prep(props)}>
      {/* barrel */}
      <line x1="40" y1="14" x2="60" y2="14" />
      <rect x="58" y="12" width="4" height="4" fill="currentColor" />
      {/* turret */}
      <path d="M20 8 h22 v8 h-22 z" />
      <circle cx="24" cy="6" r="1.6" fill="currentColor" stroke="none" />
      {/* hull */}
      <path d="M6 18 h52 v6 h-52 z" />
      {/* tread */}
      <rect x="4" y="24" width="56" height="6" rx="3" />
      <circle cx="10" cy="27" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="18" cy="27" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="26" cy="27" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="34" cy="27" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="42" cy="27" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="50" cy="27" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="56" cy="27" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ForkliftIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 56 44" {...prep(props)}>
      {/* mast */}
      <line x1="34" y1="4" x2="34" y2="34" />
      <line x1="38" y1="4" x2="38" y2="34" />
      {/* forks */}
      <line x1="38" y1="24" x2="54" y2="24" />
      <line x1="38" y1="30" x2="54" y2="30" />
      {/* cab */}
      <path d="M10 14 h22 v20 h-22 z" />
      <rect x="14" y="18" width="10" height="8" />
      {/* wheels */}
      <circle cx="14" cy="38" r="4" />
      <circle cx="28" cy="38" r="4" />
    </svg>
  );
}

/* --- Mechanical ----------------------------------------------------- */

export function GearIcon({ size = 28, ...rest }: IconProps) {
  const tooth = (i: number) => {
    const a = (i * Math.PI) / 4;
    const x1 = 32 + Math.cos(a) * 18;
    const y1 = 32 + Math.sin(a) * 18;
    const x2 = 32 + Math.cos(a) * 26;
    const y2 = 32 + Math.sin(a) * 26;
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
  };
  return (
    <svg
      viewBox="0 0 64 64"
      {...prep({ size, ...rest })}
      strokeWidth={rest.strokeWidth ?? 4}
    >
      {[0, 1, 2, 3, 4, 5, 6, 7].map(tooth)}
      <circle cx="32" cy="32" r="18" />
      <circle cx="32" cy="32" r="7" />
    </svg>
  );
}

export function WrenchIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" {...prep(props)}>
      <path d="M32 6 a12 12 0 0 0 -10 20 l-16 16 l4 4 l16 -16 a12 12 0 0 0 6 -24 l-4 6 l-4 -4 z" />
    </svg>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 40 40" {...prep(props)}>
      <polygon points="20,4 32,10 32,24 20,36 8,24 8,10" />
      <circle cx="20" cy="17" r="4" />
    </svg>
  );
}

/* --- Containers ----------------------------------------------------- */

export function CrateIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 56 48" {...prep(props)}>
      <rect x="4" y="8" width="48" height="36" />
      <line x1="4" y1="16" x2="52" y2="16" />
      <line x1="4" y1="36" x2="52" y2="36" />
      <line x1="16" y1="16" x2="16" y2="36" />
      <line x1="40" y1="16" x2="40" y2="36" />
      {/* corner bolts */}
      <circle cx="8" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="48" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="40" r="1" fill="currentColor" stroke="none" />
      <circle cx="48" cy="40" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BarrelIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 40 48" {...prep(props)}>
      <ellipse cx="20" cy="6" rx="14" ry="4" />
      <path d="M6 6 v36 a14 4 0 0 0 28 0 v-36" />
      <path d="M6 18 a14 4 0 0 0 28 0" />
      <path d="M6 30 a14 4 0 0 0 28 0" />
    </svg>
  );
}

/* --- Badges / insignia ---------------------------------------------- */

export function StarBadge(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" {...prep(props)}>
      <polygon points="24,4 30,18 45,19 33,29 37,44 24,36 11,44 15,29 3,19 18,18" />
    </svg>
  );
}

export function ChevronStack({
  count = 3,
  size = 22,
  ...rest
}: IconProps & { count?: number }) {
  const rows = Array.from({ length: count });
  return (
    <svg
      viewBox={`0 0 24 ${6 + count * 6}`}
      {...prep({ size, ...rest, strokeWidth: 2 })}
    >
      {rows.map((_, i) => (
        <polyline
          key={i}
          points={`4,${4 + i * 6} 12,${9 + i * 6} 20,${4 + i * 6}`}
        />
      ))}
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 40 48" {...prep(props)}>
      <path d="M20 4 l16 4 v14 c0 12 -8 20 -16 22 c-8 -2 -16 -10 -16 -22 v-14 z" />
      <path d="M12 20 l6 6 l12 -12" />
    </svg>
  );
}

/* --- Arrows + indicators -------------------------------------------- */

export function ArrowRight(props: IconProps) {
  return (
    <svg viewBox="0 0 28 16" {...prep(props)} strokeWidth={2.5}>
      <line x1="2" y1="8" x2="24" y2="8" />
      <polyline points="18,2 26,8 18,14" />
    </svg>
  );
}

export function ArrowDown(props: IconProps) {
  return (
    <svg viewBox="0 0 16 28" {...prep(props)} strokeWidth={2.5}>
      <line x1="8" y1="2" x2="8" y2="24" />
      <polyline points="2,18 8,26 14,18" />
    </svg>
  );
}

/* --- Factory silhouette --------------------------------------------- */

export function FactoryIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 64 40" {...prep(props)}>
      <path d="M4 36 v-16 l12 8 v-8 l12 8 v-20 h8 v28 h24 v-24 h-6 v6 h-4 v-6" />
      <line x1="4" y1="36" x2="64" y2="36" />
      <rect x="8" y="28" width="4" height="4" />
      <rect x="20" y="28" width="4" height="4" />
      <rect x="32" y="28" width="4" height="4" />
      <rect x="44" y="28" width="4" height="4" />
      <rect x="54" y="28" width="4" height="4" />
    </svg>
  );
}
