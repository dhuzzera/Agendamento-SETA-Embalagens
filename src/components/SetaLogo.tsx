import logoLight from "@/assets/seta-logo-white.png";
import logoDark from "@/assets/seta-logo-dark.png";

type Props = { variant?: "light" | "dark"; className?: string };

/**
 * Logo institucional Seta Embalagens.
 * - "light"  → para fundos escuros (logo branca)
 * - "dark"   → para fundos claros (logo azul institucional)
 */
export function SetaLogo({ variant = "dark", className = "" }: Props) {
  const src = variant === "light" ? logoLight : logoDark;
  return (
    <img
      src={src}
      alt="Seta Embalagens"
      width={1266}
      height={633}
      className={`block h-10 w-auto max-w-max shrink-0 self-start select-none ${className}`}
      decoding="async"
      loading="eager"
      draggable={false}
    />
  );
}
