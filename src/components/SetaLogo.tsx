import logoLight from "@/assets/seta-logo-white.webp";
import logoDark from "@/assets/seta-logo-dark.webp";

type Props = { variant?: "light" | "dark"; className?: string };

/**
 * Logo institucional SETA Embalagens.
 * - "light"  → para fundos escuros (logo branca)
 * - "dark"   → para fundos claros (logo azul institucional)
 */
export function SetaLogo({ variant = "dark", className = "" }: Props) {
  const src = variant === "light" ? logoLight : logoDark;
  return (
    <img
      src={src}
      alt="SETA Embalagens"
      width={320}
      height={160}
      className={`block h-10 w-auto max-w-max shrink-0 self-start select-none ${className}`}
      decoding="async"
      loading="eager"
      // Sinaliza ao browser que é o LCP candidate na home
      fetchPriority="high"
      draggable={false}
    />
  );
}
