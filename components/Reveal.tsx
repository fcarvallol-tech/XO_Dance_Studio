"use client";

import { useEffect, useRef } from "react";

/**
 * Fade-in al entrar en pantalla. Es la única animación de scroll de la página.
 * Marca el nodo con data-visible en vez de usar estado: así el efecto solo
 * toca el DOM y no dispara renders en cascada.
 * Bajo prefers-reduced-motion, globals.css lo deja visible de entrada.
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;

    const mostrar = () => elemento.setAttribute("data-visible", "true");

    if (typeof IntersectionObserver === "undefined") {
      mostrar();
      return;
    }

    const observer = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        mostrar();
        observer.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(elemento);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal=""
      style={{ transitionDelay: `${delay}ms` }}
      className={`translate-y-4 opacity-0 transition-[opacity,transform] duration-700 ease-out data-[visible=true]:translate-y-0 data-[visible=true]:opacity-100 ${className}`}
    >
      {children}
    </div>
  );
}
