import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { aNumero, colones, fecha, sumarDias } from '../src/lib/formato.ts';
import { normalizarAjustes, normalizarMateriales } from '../src/lib/normalizar.ts';
import { ErrorConflicto, RepoDatos, aBase64, deBase64 } from '../src/lib/github.ts';
import { guardarConReintento } from '../src/lib/reintento.ts';

describe('formatos', () => {
  it('colones', () => {
    expect(colones(240000)).toBe('₡240,000');
    expect(colones(2900000)).toBe('₡2,900,000');
    expect(colones(0)).toBe('₡0');
    expect(colones(-1500)).toBe('-₡1,500');
    expect(colones(null)).toBe('');
  });
  it('fechas', () => {
    expect(fecha('2026-05-24')).toBe('24/05/2026');
    expect(sumarDias('2026-05-24', 15)).toBe('2026-06-08');
    expect(sumarDias('2026-12-25', 15)).toBe('2027-01-09');
  });
  it('números escritos a mano', () => {
    expect(aNumero('2,000')).toBe(2000);
    expect(aNumero('₡2,900,000')).toBe(2900000);
    expect(aNumero('1,5')).toBe(1.5);
    expect(aNumero('3.05')).toBe(3.05);
    expect(aNumero('')).toBeNull();
    expect(aNumero('pendiente')).toBeNull();
  });
});

describe('datos iniciales', () => {
  const crudo = JSON.parse(readFileSync('datos_iniciales/ajustes.json', 'utf8'));
  const a = normalizarAjustes(crudo);

  it('los ajustes se leen completos', () => {
    expect(a.empresa.nombre).toBe('ARCE NUÑEZ');
    expect(a.usuarios.map((u) => u.nombre)).toEqual(['Pablo', 'Lin']);
    expect(a.porDefecto.porcentajeAdelanto).toBe(0.5);
    expect(a.clausulas).toHaveLength(9);
    expect(a.listas.tiposTrabajo).toHaveLength(14);
    expect(a.rendimientos.m2PorLamina).toBe(2.9768);
    expect(a.mezclas).toHaveLength(4);
  });

  it('los estados viejos (solo texto) reciben color', () => {
    expect(a.listas.estados).toHaveLength(6);
    expect(a.listas.estados[0]).toEqual({ nombre: 'Pendiente', color: expect.stringMatching(/^#/) });
  });

  it('el catálogo de materiales se carga', () => {
    const m = normalizarMateriales(JSON.parse(readFileSync('datos_iniciales/catalogo_materiales.json', 'utf8')));
    expect(m.length).toBe(41);
    expect(m.every((x) => x.precio === null && x.unidad)).toBe(true);
  });

  it('ajustes vacíos no rompen nada', () => {
    const v = normalizarAjustes(null);
    expect(v.porDefecto.prefijo).toBe('COT-');
    expect(v.usuarios).toEqual([]);
  });
});

describe('base64', () => {
  it('ida y vuelta con tildes y ñ', () => {
    const t = new TextEncoder().encode('ARCE NUÑEZ · ₡ á é');
    expect(new TextDecoder().decode(deBase64(aBase64(t)))).toBe('ARCE NUÑEZ · ₡ á é');
  });
});

/** Repositorio falso en memoria que se comporta como GitHub (sha y conflictos). */
function repoFalso(inicial: Record<string, unknown>) {
  const archivos = new Map<string, { texto: string; sha: string }>();
  let n = 0;
  for (const [k, v] of Object.entries(inicial)) archivos.set(k, { texto: JSON.stringify(v), sha: 's' + n++ });
  return {
    archivos,
    async leerJson<T>(ruta: string) {
      const a = archivos.get(ruta);
      return a ? { datos: JSON.parse(a.texto) as T, sha: a.sha } : null;
    },
    async escribirJson(ruta: string, datos: unknown, sha: string | null) {
      const a = archivos.get(ruta);
      if ((a?.sha ?? null) !== sha) throw new ErrorConflicto();
      const nuevo = { texto: JSON.stringify(datos), sha: 's' + n++ };
      archivos.set(ruta, nuevo);
      return nuevo.sha;
    },
  };
}

describe('guardar sin perder cambios del otro', () => {
  const lista = (x: unknown) => (Array.isArray(x) ? (x as string[]) : []);

  it('guarda normal cuando nadie más cambió', async () => {
    const repo = repoFalso({ 'l.json': ['a'] });
    const leido = (await repo.leerJson<string[]>('l.json'))!;
    const r = await guardarConReintento(repo, 'l.json', leido, (l) => void l.push('b'), 'm', lista);
    expect(r.datos).toEqual(['a', 'b']);
    expect(JSON.parse(repo.archivos.get('l.json')!.texto)).toEqual(['a', 'b']);
  });

  it('si Lin guardó antes, se vuelve a leer y se suman los dos cambios', async () => {
    const repo = repoFalso({ 'l.json': ['a'] });
    const leidoPablo = (await repo.leerJson<string[]>('l.json'))!;
    // Lin guarda primero.
    const leidoLin = (await repo.leerJson<string[]>('l.json'))!;
    await guardarConReintento(repo, 'l.json', leidoLin, (l) => void l.push('de Lin'), 'm', lista);
    // Pablo guarda con lo que tenía (viejo): no debe borrar lo de Lin.
    const r = await guardarConReintento(repo, 'l.json', leidoPablo, (l) => void l.push('de Pablo'), 'm', lista);
    expect(r.datos).toEqual(['a', 'de Lin', 'de Pablo']);
  });

  it('crea el archivo si todavía no existe', async () => {
    const repo = repoFalso({});
    const r = await guardarConReintento(repo, 'nuevo.json', { datos: [] as string[], sha: null }, (l) => void l.push('x'), 'm', lista);
    expect(r.datos).toEqual(['x']);
  });
});

describe('conexión con GitHub', () => {
  function fetchFalso(respuestas: Record<string, { status: number; body: unknown }>) {
    const llamadas: { url: string; init?: RequestInit }[] = [];
    const f = (async (url: string, init?: RequestInit) => {
      llamadas.push({ url, init });
      const r = respuestas[`${init?.method ?? 'GET'} ${url}`] ?? { status: 404, body: { message: 'Not Found' } };
      return new Response(JSON.stringify(r.body), { status: r.status });
    }) as unknown as typeof fetch;
    return { f, llamadas };
  }
  const base = 'https://api.github.com/repos/yo/datos';
  const conexion = { base: 'https://api.github.com', owner: 'yo', repo: 'datos', token: 't' };

  it('lee un JSON y manda el token', async () => {
    const contenido = aBase64(new TextEncoder().encode('{"x":"ñ"}'));
    const { f, llamadas } = fetchFalso({ [`GET ${base}/contents/a.json`]: { status: 200, body: { sha: 'abc', content: contenido, encoding: 'base64', size: 9 } } });
    const r = await new RepoDatos(conexion, f).leerJson<{ x: string }>('a.json');
    expect(r).toEqual({ datos: { x: 'ñ' }, sha: 'abc' });
    expect((llamadas[0].init!.headers as Record<string, string>).Authorization).toBe('Bearer t');
    expect(llamadas[0].init!.cache).toBe('no-store');
  });

  it('un archivo que no existe devuelve null', async () => {
    const { f } = fetchFalso({});
    expect(await new RepoDatos(conexion, f).leer('no.json')).toBeNull();
  });

  it('conflicto al guardar → ErrorConflicto', async () => {
    const { f } = fetchFalso({ [`PUT ${base}/contents/a.json`]: { status: 409, body: { message: 'does not match' } } });
    await expect(new RepoDatos(conexion, f).escribirJson('a.json', {}, 'viejo', 'm')).rejects.toBeInstanceOf(ErrorConflicto);
  });

  it('token malo → mensaje entendible', async () => {
    const { f } = fetchFalso({ [`GET ${base}`]: { status: 401, body: { message: 'Bad credentials' } } });
    await expect(new RepoDatos(conexion, f).probar()).rejects.toThrow(/token no es válido/);
  });

  it('lee el último cambio (para actualizar solo cuando el otro guarda)', async () => {
    const { f } = fetchFalso({
      [`GET ${base}/commits?per_page=1`]: { status: 200, body: [{ sha: 'c1', commit: { message: 'Lin: agregó el material «X»' } }] },
    });
    expect(await new RepoDatos(conexion, f).ultimoCambio()).toEqual({ sha: 'c1', mensaje: 'Lin: agregó el material «X»' });
  });

  it('repositorio sin cambios todavía → null', async () => {
    const { f } = fetchFalso({ [`GET ${base}/commits?per_page=1`]: { status: 409, body: { message: 'Git Repository is empty.' } } });
    expect(await new RepoDatos(conexion, f).ultimoCambio()).toBeNull();
  });

  const contenido = { sha: 'abc', content: aBase64(new TextEncoder().encode('{}')), encoding: 'base64', size: 2 };

  it('token solo de lectura: se detecta al conectar, sin cambiar nada', async () => {
    const { f, llamadas } = fetchFalso({
      [`GET ${base}`]: { status: 200, body: { private: true } },
      [`GET ${base}/contents/ajustes.json`]: { status: 200, body: contenido },
      [`PUT ${base}/contents/ajustes.json`]: { status: 403, body: { message: 'Resource not accessible by personal access token' } },
    });
    await expect(new RepoDatos(conexion, f).probar()).rejects.toThrow(/Read and write/);
    // La prueba usa una huella falsa: nunca pudo haber guardado nada.
    expect(JSON.parse(llamadas.find((l) => l.init?.method === 'PUT')!.init!.body as string).sha).toBe('0'.repeat(40));
  });

  it('token con permiso de escritura: la prueba pasa (GitHub responde 409 por la huella falsa)', async () => {
    const { f } = fetchFalso({
      [`GET ${base}`]: { status: 200, body: { private: true } },
      [`GET ${base}/contents/ajustes.json`]: { status: 200, body: contenido },
      [`PUT ${base}/contents/ajustes.json`]: { status: 409, body: { message: 'does not match' } },
    });
    expect(await new RepoDatos(conexion, f).probar()).toEqual({ privado: true });
  });

  it('detecta un repositorio público', async () => {
    const { f } = fetchFalso({ [`GET ${base}`]: { status: 200, body: { private: false, permissions: { push: true } } } });
    expect(await new RepoDatos(conexion, f).probar()).toEqual({ privado: false });
  });
});

describe('fechas con hora', () => {
  it('de noche en Costa Rica no sale el día siguiente', () => {
    // 10:30 p. m. del 11 de noviembre en Costa Rica = 04:30 del 12 en hora internacional.
    const iso = new Date(2026, 10, 11, 22, 30).toISOString();
    expect(fecha(iso)).toBe('11/11/2026');
  });
  it('las importadas del Excel muestran solo la fecha', async () => {
    const { fechaHora } = await import('../src/lib/formato.ts');
    expect(fechaHora('2026-05-24T00:00:00')).toBe('24/05/2026');
  });
});
