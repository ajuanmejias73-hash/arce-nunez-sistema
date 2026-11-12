/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { servidorDatosLocal } from './servidor-local.ts';

export default defineConfig({
  // Rutas relativas: la página funciona en GitHub Pages dentro de /arce-nunez-sistema/.
  base: './',
  plugins: [svelte(), servidorDatosLocal(import.meta.dirname)],
  // La versión de prueba solo se ve en esta compu.
  server: { host: '127.0.0.1', port: 5310, strictPort: true },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
