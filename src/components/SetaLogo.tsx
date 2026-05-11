type Props = { variant?: "light" | "dark"; className?: string };

export function SetaLogo({ variant = "light", className = "" }: Props) {
  const color = variant === "light" ? "#ffffff" : "var(--color-primary)";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 64 28" className="h-7 w-auto" aria-hidden>
        <text
          x="0"
          y="22"
          fontFamily="Inter, system-ui, sans-serif"
          fontWeight="900"
          fontSize="26"
          fill={color}
          letterSpacing="-1"
        >
          SETA
        </text>
      </svg>
      <span
        className="text-[10px] font-semibold tracking-[0.22em]"
        style={{ color }}
      >
        EMBALAGENS
      </span>
    </div>
  );
}
