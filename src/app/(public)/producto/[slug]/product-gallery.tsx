"use client";

import Image from "next/image";
import { useState } from "react";

export function ProductGallery({ images, name }: { images: { url: string; alt: string }[]; name: string }) {
  const [index, setIndex] = useState(0);
  const current = images[index];

  if (!current) {
    return <div className="grid aspect-square place-items-center rounded-3xl bg-surface text-muted">Foto próximamente</div>;
  }

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-surface">
        <Image src={current.url} alt={current.alt || name} fill priority sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
      </div>
      {images.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Fotos del producto">
          {images.map((img, i) => (
            <li key={img.url}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ver foto ${i + 1}`}
                aria-current={i === index}
                className={`relative block size-16 overflow-hidden rounded-xl border-2 sm:size-20 ${i === index ? "border-brand" : "border-transparent opacity-80 hover:opacity-100"}`}
              >
                <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
