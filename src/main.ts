import { mount } from 'svelte';
import './estilos.css';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });

// Solo en la versión de prueba de esta compu (no existe en la página publicada):
// acceso para revisar el PDF y la imagen sin tocar la cotización abierta.
if (import.meta.env.DEV) {
  Promise.all([import('./lib/exportar.svelte.ts'), import('./lib/datos.svelte.ts')]).then(([e, d]) => {
    (window as unknown as Record<string, unknown>).__prueba = { exportador: e.exportador, datos: d.datos };
  });
}
