"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconArrowRight } from "@/components/ui/icons";

export interface CarouselSlide {
  id: string;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  alt: string;
  startsAt: string | null;
  endsAt: string | null;
  desktopSrcSet: string;
  mobileSrcSet: string | null;
  fallbackSrc: string;
}

/** Carrusel de banners propios. Avanza solo cada 6 s (salvo movimiento reducido). */
export function BannerCarousel({ slides: all }: { slides: CarouselSlide[] }) {
  const [now, setNow] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setNow(Date.now()), 0);
    const i = setInterval(() => setNow(Date.now()), 60000);
    return () => {
      clearTimeout(t);
      clearInterval(i);
    };
  }, []);

  // Fechas reales: un banner que venció mientras la página estaba en caché no se muestra.
  const slides = now === null ? all : all.filter((s) => (!s.startsAt || new Date(s.startsAt).getTime() <= now) && (!s.endsAt || now < new Date(s.endsAt).getTime()));
  const count = slides.length;
  const current = count ? index % count : 0;

  useEffect(() => {
    if (count < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(t);
  }, [count, paused]);

  if (!count) return null;

  return (
    <div
      className="relative overflow-hidden rounded-3xl bg-[#111111]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      role="region"
      aria-roledescription="carrusel"
      aria-label="Promociones"
    >
      {slides.map((s, i) => (
        <div
          key={s.id}
          className={`relative transition-opacity duration-500 ${i === current ? "opacity-100" : "pointer-events-none absolute inset-0 opacity-0"}`}
          aria-hidden={i !== current}
          role="group"
          aria-roledescription="diapositiva"
          aria-label={`${i + 1} de ${count}`}
        >
          <picture>
            <source media="(min-width: 768px)" srcSet={s.desktopSrcSet} />
            {s.mobileSrcSet && <source srcSet={s.mobileSrcSet} />}
            {/* Imagen distinta en celular y computadora; srcset optimizado con getImageProps. */}
            <img
              src={s.fallbackSrc}
              alt={s.alt}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              className={`w-full object-cover ${s.mobileSrcSet ? "aspect-square md:aspect-[16/7]" : "aspect-[16/9] md:aspect-[16/7]"}`}
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
          <div className="absolute inset-y-0 left-0 flex max-w-xl flex-col justify-end p-6 text-white sm:justify-center sm:p-10">
            <h2 className="text-2xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">{s.title}</h2>
            {s.subtitle && <p className="mt-2 text-sm text-white/85 sm:text-lg">{s.subtitle}</p>}
            {s.ctaLabel && s.ctaHref && (
              <Link href={s.ctaHref} tabIndex={i === current ? 0 : -1} className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-accent px-6 py-3 font-bold text-accent-contrast hover:brightness-95">
                {s.ctaLabel} <IconArrowRight className="size-5" />
              </Link>
            )}
          </div>
        </div>
      ))}
      {count > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Ver promoción ${i + 1}`}
              aria-current={i === current}
              className={`h-2 rounded-full transition-all ${i === current ? "w-6 bg-accent" : "w-2 bg-white/60"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
