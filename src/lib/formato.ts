/** Formatos de Costa Rica que usa todo el sistema. */

/** ₡240,000 (sin decimales; los negativos llevan signo). */
export function colones(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  const r = Math.round(n);
  const s = Math.abs(r).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (r < 0 ? '-₡' : '₡') + s;
}

/**
 * "2026-05-24" → "24/05/2026". Una fecha con hora en hora internacional ("…T04:10:00.000Z")
 * se pasa primero a la hora de Costa Rica (si no, de noche saldría el día siguiente).
 */
export function fecha(iso: string | null | undefined): string {
  let s = iso ?? '';
  if (/T.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) s = hoyISO(d);
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Fecha y hora local: "24/05/2026 3:05 p. m." (solo la fecha si no tiene hora de verdad). */
export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}(T00:00(:00)?)?$/.test(iso)) return fecha(iso);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = h < 12 ? 'a. m.' : 'p. m.';
  return `${fecha(hoyISO(d))} ${h % 12 || 12}:${min} ${ampm}`;
}

/** Fecha local en formato "aaaa-mm-dd". */
export function hoyISO(d = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Suma días a una fecha "aaaa-mm-dd" (sin problemas de zona horaria). */
export function sumarDias(iso: string, dias: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + dias));
  return d.toISOString().slice(0, 10);
}

/** 0.5 → "50%". */
export function porcentaje(fraccion: number): string {
  return `${Math.round(fraccion * 1000) / 10}%`;
}

/** Convierte lo que se escribe en una casilla a número ("1,5" o "₡2,000" también sirven). */
export function aNumero(texto: string | number | null | undefined): number | null {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null;
  if (!texto) return null;
  let s = String(texto).trim().replace(/[₡\s]/g, '');
  // "2,000" o "2,000,000" → miles; "1,5" → decimal.
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  const n = Number(s);
  return s !== '' && Number.isFinite(n) ? n : null;
}
