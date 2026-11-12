import { mount } from 'svelte';
import './estilos.css';
import App from './App.svelte';

/**
 * Si se publicó una versión nueva mientras la página estaba abierta, los archivos viejos
 * (PDF, imagen, respaldo) ya no existen en GitHub Pages. En ese caso se recarga sola.
 * Lo que se estaba escribiendo no se pierde: el borrador se guarda en el dispositivo.
 */
const CLAVE_RECARGA = 'arce.recargaPorVersion';
window.addEventListener('vite:preloadError', (ev) => {
  let ultima = 0;
  try {
    ultima = Number(sessionStorage.getItem(CLAVE_RECARGA) ?? 0);
  } catch {
    /* sin almacenamiento */
  }
  // Solo una vez por minuto, para no quedar recargando si el problema es otro (ej. sin internet).
  if (Date.now() - ultima < 60_000) return;
  ev.preventDefault();
  try {
    sessionStorage.setItem(CLAVE_RECARGA, String(Date.now()));
  } catch {
    /* sin almacenamiento */
  }
  const aviso = document.createElement('div');
  aviso.textContent = 'Hay una versión nueva del sistema. Recargando…';
  aviso.setAttribute('role', 'status');
  aviso.style.cssText =
    'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);background:#323232;color:#fff;padding:12px 16px;border-radius:8px;z-index:100;font:600 15px Arial,sans-serif';
  document.body.appendChild(aviso);
  // Medio segundo para que el borrador termine de guardarse.
  setTimeout(() => location.reload(), 600);
});

mount(App, { target: document.getElementById('app')! });

// Solo en la versión de prueba de esta compu (no existe en la página publicada):
// acceso para revisar el PDF y la imagen sin tocar la cotización abierta.
if (import.meta.env.DEV) {
  Promise.all([import('./lib/exportar.svelte.ts'), import('./lib/datos.svelte.ts')]).then(([e, d]) => {
    (window as unknown as Record<string, unknown>).__prueba = { exportador: e.exportador, datos: d.datos };
  });
}
