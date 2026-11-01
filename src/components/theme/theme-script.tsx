import { THEME_STORAGE_KEY } from "./theme";

/**
 * Aplica el tema guardado antes del primer pintado (evita el parpadeo).
 * Sin preferencia guardada no se toca nada y manda prefers-color-scheme.
 */
export function ThemeScript() {
  const js = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
