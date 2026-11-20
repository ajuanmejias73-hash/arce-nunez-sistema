/** Ordenar el catálogo de materiales por categoría → tipo → medida. */
import type { Material } from './tipos.ts';

export const SIN_CATEGORIA = 'Sin categoría';

export const categoriaDe = (m: Material): string => m.categoria.trim() || SIN_CATEGORIA;
export const tipoDe = (m: Material): string => m.tipo?.trim() || m.material;

const comparar = new Intl.Collator('es', { numeric: true, sensitivity: 'base' }).compare;

/** Lo que distingue a un material dentro de su tipo: la medida y lo que sigue (marca, color…). */
export function etiquetaMedida(m: Material): string {
  const tipo = tipoDe(m);
  let resto = m.material;
  if (resto.toLowerCase().startsWith(tipo.toLowerCase())) resto = resto.slice(tipo.length);
  resto = resto.trim();
  return resto || m.medida?.trim() || m.material;
}

/** Categorías con cuántos materiales tiene cada una, en orden alfabético. */
export function categorias(lista: Material[]): { nombre: string; cantidad: number }[] {
  const n = new Map<string, number>();
  for (const m of lista) n.set(categoriaDe(m), (n.get(categoriaDe(m)) ?? 0) + 1);
  return [...n].map(([nombre, cantidad]) => ({ nombre, cantidad })).sort((a, b) => comparar(a.nombre, b.nombre));
}

/** Tipos de una categoría, con cuántos materiales tiene cada uno. */
export function tipos(lista: Material[], categoria: string): { nombre: string; cantidad: number }[] {
  const n = new Map<string, number>();
  for (const m of lista) if (categoriaDe(m) === categoria) n.set(tipoDe(m), (n.get(tipoDe(m)) ?? 0) + 1);
  return [...n].map(([nombre, cantidad]) => ({ nombre, cantidad })).sort((a, b) => comparar(a.nombre, b.nombre));
}

/** Los materiales de un tipo, ordenados por medida (1/2" antes que 3/4", 6 mm antes que 12 mm…). */
export function deTipo(lista: Material[], categoria: string, tipo: string): Material[] {
  return lista.filter((m) => categoriaDe(m) === categoria && tipoDe(m) === tipo).sort((a, b) => comparar(etiquetaMedida(a), etiquetaMedida(b)));
}

/** Buscar por palabras (todas tienen que estar, en cualquier orden y sin tildes). */
export function buscar(lista: Material[], texto: string): Material[] {
  const sinTildes = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const palabras = sinTildes(texto).split(/\s+/).filter(Boolean);
  if (!palabras.length) return lista;
  return lista.filter((m) => {
    const t = sinTildes(`${m.material} ${m.categoria} ${m.tipo ?? ''} ${(m.antes ?? []).join(' ')}`);
    return palabras.every((p) => t.includes(p));
  });
}
