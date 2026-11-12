/**
 * Lectura y escritura de archivos en el repositorio PRIVADO de datos, con la API de GitHub.
 * Cada archivo tiene un "sha" (su huella). Al guardar se manda el sha que se leyó:
 * si el otro usuario guardó antes, GitHub lo rechaza (ErrorConflicto) y se vuelve a intentar.
 */

export interface Conexion {
  /** "https://api.github.com" (o el servidor de prueba local). */
  base: string;
  owner: string;
  repo: string;
  token: string;
}

export class ErrorConflicto extends Error {
  constructor() {
    super('El archivo cambió mientras se guardaba.');
  }
}

export class ErrorGitHub extends Error {
  constructor(
    mensaje: string,
    public estado: number,
  ) {
    super(mensaje);
  }
}

export interface Archivo {
  bytes: Uint8Array;
  sha: string;
}

export function aBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function deBase64(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function mensajeError(estado: number, cuerpo: { message?: string }): string {
  const m = cuerpo.message ?? '';
  if (estado === 401) return 'El token no es válido o ya se venció. Pegá uno nuevo en "Conexión".';
  if (estado === 403 && /rate limit/i.test(m)) return 'GitHub pidió esperar un momento (demasiadas consultas). Probá de nuevo en unos minutos.';
  if (estado === 403) {
    return 'El token solo puede leer, no guardar. Entrá a GitHub → Settings → Developer settings → Fine-grained tokens → tu token → Edit, poné Contents en "Read and write" y tocá Update. No hace falta pegarlo otra vez.';
  }
  if (estado === 404) return 'No se encontró el repositorio de datos, o el token no tiene acceso a él.';
  return `GitHub respondió con un error (${estado}). ${m}`.trim();
}

export class RepoDatos {
  constructor(
    private c: Conexion,
    private fetchFn: typeof fetch = (...a) => fetch(...a),
  ) {}

  private get raiz() {
    return `${this.c.base}/repos/${encodeURIComponent(this.c.owner)}/${encodeURIComponent(this.c.repo)}`;
  }

  private url(ruta: string) {
    return `${this.raiz}/contents/${ruta.split('/').map(encodeURIComponent).join('/')}`;
  }

  private async pedir(url: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await this.fetchFn(url, {
        ...init,
        // Nunca usar copias guardadas por el navegador: siempre lo último del repositorio.
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${this.c.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
      });
    } catch {
      throw new ErrorGitHub('No hay conexión a internet (o GitHub no responde).', 0);
    }
  }

  private async fallar(r: Response): Promise<never> {
    const cuerpo = await r.json().catch(() => ({}));
    throw new ErrorGitHub(mensajeError(r.status, cuerpo), r.status);
  }

  /** Revisa que el token sirva y pueda escribir en el repositorio. */
  async probar(): Promise<{ privado: boolean }> {
    const r = await this.pedir(this.raiz);
    if (!r.ok) await this.fallar(r);
    const info = (await r.json()) as { private?: boolean; permissions?: { push?: boolean } };
    if (info.permissions && info.permissions.push === false) {
      throw new ErrorGitHub('El token puede leer pero no guardar. Dale permiso de "Contents: Read and write".', 403);
    }
    await this.probarEscritura();
    return { privado: info.private === true };
  }

  /**
   * Prueba de escritura que no cambia nada: intenta guardar con una huella falsa.
   * Con permiso de escritura GitHub responde 409 o 422; sin permiso, 403.
   */
  private async probarEscritura(): Promise<void> {
    const existe = await this.leer('ajustes.json');
    if (!existe) return;
    const r = await this.pedir(this.url('ajustes.json'), {
      method: 'PUT',
      body: JSON.stringify({ message: 'prueba de permiso', content: '', sha: '0'.repeat(40) }),
    });
    if (r.status === 401 || r.status === 403) await this.fallar(r);
  }

  /**
   * El último cambio guardado en el repositorio (una sola consulta, muy liviana).
   * Sirve para saber si la otra persona guardó algo sin tener que leer todos los archivos.
   */
  async ultimoCambio(): Promise<{ sha: string; mensaje: string } | null> {
    const r = await this.pedir(`${this.raiz}/commits?per_page=1`);
    if (r.status === 409) return null; // repositorio vacío
    if (!r.ok) await this.fallar(r);
    const lista = (await r.json()) as { sha: string; commit?: { message?: string } }[];
    return lista[0] ? { sha: lista[0].sha, mensaje: lista[0].commit?.message ?? '' } : null;
  }

  /** Lee un archivo. Devuelve null si no existe. */
  async leer(ruta: string): Promise<Archivo | null> {
    const r = await this.pedir(this.url(ruta));
    if (r.status === 404) return null;
    if (!r.ok) await this.fallar(r);
    const info = (await r.json()) as { sha: string; content?: string; encoding?: string; size?: number };
    if (info.content && info.encoding === 'base64') return { bytes: deBase64(info.content), sha: info.sha };
    if (!info.size) return { bytes: new Uint8Array(), sha: info.sha };
    // Archivos de más de 1 MB: GitHub no manda el contenido aquí; se pide aparte.
    const rb = await this.pedir(`${this.raiz}/git/blobs/${info.sha}`);
    if (!rb.ok) await this.fallar(rb);
    const blob = (await rb.json()) as { content: string };
    return { bytes: deBase64(blob.content), sha: info.sha };
  }

  async leerJson<T>(ruta: string): Promise<{ datos: T; sha: string } | null> {
    const a = await this.leer(ruta);
    if (!a) return null;
    const texto = new TextDecoder().decode(a.bytes).replace(/^﻿/, '');
    return { datos: JSON.parse(texto) as T, sha: a.sha };
  }

  /**
   * Guarda un archivo. `sha` = huella de la versión que se leyó (null si es nuevo).
   * Devuelve la huella nueva. Lanza ErrorConflicto si alguien lo cambió antes.
   */
  async escribir(ruta: string, bytes: Uint8Array, sha: string | null, mensaje: string): Promise<string> {
    const r = await this.pedir(this.url(ruta), {
      method: 'PUT',
      body: JSON.stringify({ message: mensaje, content: aBase64(bytes), ...(sha ? { sha } : {}) }),
    });
    if (r.status === 409 || r.status === 422) throw new ErrorConflicto();
    if (!r.ok) await this.fallar(r);
    const info = (await r.json()) as { content: { sha: string } };
    return info.content.sha;
  }

  async escribirJson(ruta: string, datos: unknown, sha: string | null, mensaje: string): Promise<string> {
    const texto = JSON.stringify(datos, null, 1) + '\n';
    return this.escribir(ruta, new TextEncoder().encode(texto), sha, mensaje);
  }

  async borrar(ruta: string, sha: string, mensaje: string): Promise<void> {
    const r = await this.pedir(this.url(ruta), {
      method: 'DELETE',
      body: JSON.stringify({ message: mensaje, sha }),
    });
    if (r.status === 404) return;
    if (r.status === 409 || r.status === 422) throw new ErrorConflicto();
    if (!r.ok) await this.fallar(r);
  }
}
