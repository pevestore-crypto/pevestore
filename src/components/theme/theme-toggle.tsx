"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { applyTheme, readStoredTheme, resolvedTheme } from "./theme";

const THEME_EVENT = "pevestore-theme-change";

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}

const isDarkNow = () => resolvedTheme(readStoredTheme()) === "dark";

export function ThemeToggle() {
  // null en el servidor: el ícono se decide en el navegador.
  const isDark = useSyncExternalStore(subscribe, isDarkNow, () => null);

  useLayoutEffect(() => {
    // En desarrollo, Strict Mode limpia el atributo de <html>; se vuelve a aplicar.
    const choice = readStoredTheme();
    if (choice !== "system") applyTheme(choice);
  }, []);

  function toggle() {
    applyTheme(isDark ? "light" : "dark");
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  const label = isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="grid size-10 place-items-center rounded-full text-foreground transition-colors hover:bg-surface"
    >
      {isDark ? (
        <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
