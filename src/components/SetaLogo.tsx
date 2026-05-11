type Props = { variant?: "light" | "dark"; className?: string };

/**
 * Logo institucional Seta Embalagens.
 * - "light"  → fundos escuros (texto branco)
 * - "dark"   → fundos claros (texto azul institucional)
 * Inclui o "tick/seta" diagonal característico do logo oficial sobre o "A".
 */
export function SetaLogo({ variant = "dark", className = "" }: Props) {
  const color = variant === "light" ? "#ffffff" : "var(--color-primary)";
  const subColor = variant === "light" ? "rgba(255,255,255,0.85)" : "var(--color-primary)";
  return (
    <div className={`flex items-center gap-2.5 ${className}`} aria-label="Seta Embalagens">
      <svg viewBox="0 0 90 36" className="h-8 w-auto" aria-hidden>
        <text
          x="0"
          y="26"
          fontFamily="Inter, system-ui, sans-serif"
          fontWeight="900"
          fontSize="28"
          fill={color}
          letterSpacing="-1"
        >
          SETA
        </text>
        {/* "Seta" diagonal sobre o conjunto */}
        <path
          d="M62 6 L82 6 L82 11 L73 11 L73 16 L67 16 Z"
          fill={color}
          opacity="0.95"
        />
      </svg>
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.28em]"
        style={{ color: subColor }}
      >
        Embalagens
      </span>
    </div>
  );
}
