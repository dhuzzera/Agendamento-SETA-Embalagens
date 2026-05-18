import logoLight from "@/assets/seta-logo-white.webp";
import logoDark from "@/assets/seta-logo-dark.webp";

type Props = { variant?: "light" | "dark" | "auto"; className?: string };

/**
 * Logo institucional SETA Embalagens.
 * - "light"  → para fundos escuros (logo branca)
 * - "dark"   → para fundos claros (logo azul institucional)
 * - "auto"   → detecta o tema atual (dark mode = logo branca, light mode = logo azul)
 */
export function SetaLogo({ variant = "auto", className = "" }: Props) {
  if (variant === "auto") {
    // Renderiza ambas e usa CSS para mostrar a correta
    return (
      <picture>
        <source srcSet={logoLight} media="(prefers-color-scheme: dark)" />
        <img
          src={logoDark}
          alt="SETA Embalagens"
          width={320}
          height={160}
          className={`block h-10 w-auto max-w-max shrink-0 self-start select-none dark:hidden ${className}`}
          decoding="async"
          loading="eager"
          fetchPriority="high"
          draggable={false}
        />
        <img
          src={logoLight}
          alt="SETA Embalagens"
          width={320}
          height={160}
          className={`hidden h-10 w-auto max-w-max shrink-0 self-start select-none dark:block ${className}`}
          decoding="async"
          loading="eager"
          draggable={false}
        />
      </picture>
    );
  }

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
      fetchPriority="high"
      draggable={false}
    />
  );
}
