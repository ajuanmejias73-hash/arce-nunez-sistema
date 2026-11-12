/** Botón "Respaldo": todos los datos (y sus fotos, PDF y logo) en un solo .zip. */
import { datos } from './datos.svelte.ts';
import { hoyISO } from './formato.ts';

const ARCHIVOS = {
  'ajustes.json': 'ajustes',
  'catalogo_materiales.json': 'materiales',
  'catalogo_servicios.json': 'servicios',
  'cotizaciones.json': 'cotizaciones',
  'movimientos.json': 'movimientos',
  'trabajadores.json': 'trabajadores',
  'horas.json': 'horas',
} as const;

export async function crearRespaldo(avance: (texto: string) => void): Promise<{ blob: Blob; nombre: string; faltaron: string[] }> {
  const c = datos.c;
  const repo = datos.repo;
  if (!c || !repo) throw new Error('No hay conexión con los datos.');
  const { zipSync, strToU8 } = await import('fflate');
  const copia = JSON.parse(JSON.stringify(c)) as Record<string, unknown>;

  const archivos: Record<string, Uint8Array> = {};
  for (const [nombre, clave] of Object.entries(ARCHIVOS)) archivos[nombre] = strToU8(JSON.stringify(copia[clave], null, 1) + '\n');

  // Fotos, PDF y logo que usan los datos.
  const rutas = new Set<string>([c.ajustes.empresa.logo]);
  for (const q of c.cotizaciones) {
    for (const v of q.versiones) {
      v.datos.fotos.forEach((f) => rutas.add(f));
      if (v.pdf) rutas.add(v.pdf);
    }
  }
  const faltaron: string[] = [];
  let n = 0;
  for (const ruta of rutas) {
    avance(`Bajando archivos… ${++n} de ${rutas.size}`);
    const a = await repo.leer(ruta).catch(() => null);
    if (a) archivos[ruta] = a.bytes;
    else faltaron.push(ruta);
  }
  avance('Armando el .zip…');
  // Las fotos y los PDF ya vienen comprimidos: se guardan tal cual (más rápido).
  const zip = zipSync(Object.fromEntries(Object.entries(archivos).map(([k, v]) => [k, [v, { level: k.endsWith('.json') ? 6 : 0 }]])));
  return { blob: new Blob([zip as BlobPart], { type: 'application/zip' }), nombre: `Respaldo Arce Nuñez ${hoyISO()}.zip`, faltaron };
}
