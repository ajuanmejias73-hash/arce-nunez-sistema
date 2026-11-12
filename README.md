# Arce Nuñez · Sistema de cotizaciones y contabilidad

Página interna (Svelte + Vite) publicada con GitHub Pages.

**Los datos no están en este repositorio.** Viven en un repositorio **privado** aparte
(`arce-nunez-datos`) y la página los lee y guarda con la API de GitHub usando un token
que se pega una sola vez en cada dispositivo.

## Para trabajar en la compu

```bash
npm install
npm run dev     # versión de prueba en http://127.0.0.1:5310 (usa datos_prueba/, que no se sube)
npm test        # pruebas (necesitan la carpeta datos_iniciales/, que no se sube)
npm run check   # revisión de tipos
```

Cada cambio que se sube a `main` se publica solo (ver `.github/workflows/publicar.yml`).
