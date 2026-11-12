/**
 * Servidor de datos de PRUEBA (solo en esta compu, nunca en la página publicada).
 *
 * Imita la API de contenidos de GitHub para que la página se pueda probar sin
 * token ni internet, usando exactamente el mismo código que en producción.
 * Los datos se guardan en la carpeta datos_prueba/ (copia de datos_iniciales/).
 */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

const PREFIJO = '/__github/repos/local/datos';

function shaDe(contenido: Buffer): string {
  return createHash('sha1').update(contenido).digest('hex');
}

function responder(res: ServerResponse, estado: number, cuerpo: unknown) {
  res.statusCode = estado;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(cuerpo));
}

async function leerCuerpo(req: IncomingMessage): Promise<Record<string, unknown>> {
  const partes: Buffer[] = [];
  for await (const p of req) partes.push(p as Buffer);
  const texto = Buffer.concat(partes).toString('utf8');
  return texto ? JSON.parse(texto) : {};
}

export function servidorDatosLocal(raiz: string): Plugin {
  const carpeta = resolve(raiz, 'datos_prueba');
  const iniciales = resolve(raiz, 'datos_iniciales');

  return {
    name: 'servidor-datos-local',
    apply: 'serve',
    configureServer(server) {
      if (!existsSync(carpeta) && existsSync(iniciales)) {
        cpSync(iniciales, carpeta, { recursive: true });
      }
      mkdirSync(carpeta, { recursive: true });
      // Imita el "último cambio" (commit) de GitHub: cambia cada vez que alguien guarda.
      let ultimo = { sha: 'inicio-' + Date.now(), commit: { message: 'Datos iniciales' } };

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://local');
        if (!url.pathname.startsWith(PREFIJO)) return next();

        try {
          // Información del repositorio (para "Probar conexión").
          if (url.pathname === PREFIJO || url.pathname === PREFIJO + '/') {
            return responder(res, 200, { full_name: 'local/datos', private: true, permissions: { push: true } });
          }

          const resto = url.pathname.slice(PREFIJO.length);
          if (resto === '/commits' && req.method === 'GET') return responder(res, 200, [ultimo]);
          if (!resto.startsWith('/contents/')) return responder(res, 404, { message: 'Not Found' });
          const ruta = decodeURIComponent(resto.slice('/contents/'.length));
          const archivo = resolve(carpeta, ruta);
          if (!archivo.startsWith(carpeta + sep)) return responder(res, 400, { message: 'Ruta inválida' });

          const existe = existsSync(archivo);
          const actual = existe ? readFileSync(archivo) : null;

          if (req.method === 'GET') {
            if (!actual) return responder(res, 404, { message: 'Not Found' });
            return responder(res, 200, {
              type: 'file',
              path: ruta,
              sha: shaDe(actual),
              size: actual.length,
              encoding: 'base64',
              content: actual.toString('base64'),
            });
          }

          if (req.method === 'PUT' || req.method === 'DELETE') {
            const cuerpo = await leerCuerpo(req);
            const sha = typeof cuerpo.sha === 'string' ? cuerpo.sha : null;
            if (actual && !sha) return responder(res, 422, { message: '"sha" wasn\'t supplied.' });
            if (actual && sha !== shaDe(actual)) return responder(res, 409, { message: 'does not match' });
            ultimo = { sha: 'c-' + Date.now() + '-' + Math.random().toString(36).slice(2), commit: { message: String(cuerpo.message ?? '') } };
            if (req.method === 'DELETE') {
              if (!actual) return responder(res, 404, { message: 'Not Found' });
              rmSync(archivo);
              return responder(res, 200, { content: null });
            }
            const nuevo = Buffer.from(String(cuerpo.content ?? ''), 'base64');
            mkdirSync(dirname(archivo), { recursive: true });
            writeFileSync(archivo, nuevo);
            return responder(res, existe ? 200 : 201, { content: { path: ruta, sha: shaDe(nuevo) } });
          }

          return responder(res, 405, { message: 'Método no permitido' });
        } catch (e) {
          return responder(res, 500, { message: String(e) });
        }
      });
    },
  };
}
