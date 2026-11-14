/**
 * Cotización automática con Claude (claude.ai), sin costo para el sistema:
 * 1) el sistema arma una instrucción detallada con los precios, servicios, condiciones y
 *    ejemplos de Arce Nuñez; 2) Claude hace preguntas de selección múltiple;
 * 3) Claude devuelve un código (JSON) que aquí se lee para llenar la cotización.
 */
import { categoriaSugerida } from './contabilidad.ts';
import { colones, porcentaje } from './formato.ts';
import { normalizarDatos, ultimaVersion } from './cotizacion.ts';
import type { Ajustes, Cotizacion, DatosCotizacion, Material, Servicio } from './tipos.ts';

export const MARCA_CODIGO = 'arce_nunez_cotizacion';

/** Ejemplos de cómo escriben las Partes (de sus cotizaciones guardadas). */
function ejemplos(cotizaciones: Cotizacion[]): string {
  const elegidas = [...cotizaciones]
    .map((c) => ultimaVersion(c).datos)
    .filter((d) => d.partes.some((p) => p.nombre.trim() && p.renglones.length >= 3))
    .sort((a, b) => b.partes.length - a.partes.length)
    .slice(0, 2);
  return elegidas
    .map((d) => {
      const partes = d.partes
        .filter((p) => p.nombre.trim())
        .slice(0, 3)
        .map((p) => `  Parte «${p.nombre}»:\n${p.renglones.slice(0, 6).map((r) => `    - ${r.texto}`).join('\n')}`)
        .join('\n');
      return `• ${d.tipoTrabajo || 'Trabajo'}: ${d.trabajoSolicitado}\n${partes}`;
    })
    .join('\n\n');
}

export interface Contexto {
  ajustes: Ajustes;
  materiales: Material[];
  servicios: Servicio[];
  cotizaciones: Cotizacion[];
  /** Si la cotización abierta ya tiene datos del cliente, se le pasan a Claude. */
  actual?: Pick<DatosCotizacion, 'cliente' | 'telefono' | 'ubicacion' | 'tipoTrabajo' | 'trabajoSolicitado'>;
}

/** La instrucción completa que se copia y se pega en Claude. */
export function instruccionCotizacion(x: Contexto): string {
  const e = x.ajustes.empresa;
  const d = x.ajustes.porDefecto;
  const conPrecio = x.materiales.filter((m) => m.precio !== null);
  const sinPrecio = x.materiales.filter((m) => m.precio === null);
  const servicios = x.servicios.map((s) => `- ${s.servicio} (${s.formaCobro}${s.precio !== null ? `: ${colones(s.precio)}` : ': sin precio'})${s.descripcion ? ` — ${s.descripcion}` : ''}`);
  const actual = x.actual && (x.actual.cliente || x.actual.trabajoSolicitado)
    ? `\nYA SABEMOS ESTO (no lo vuelvas a preguntar, solo confirmalo al final):\n${[
        x.actual.cliente && `- Cliente: ${x.actual.cliente}`,
        x.actual.telefono && `- Teléfono: ${x.actual.telefono}`,
        x.actual.ubicacion && `- Ubicación: ${x.actual.ubicacion}`,
        x.actual.tipoTrabajo && `- Tipo de trabajo: ${x.actual.tipoTrabajo}`,
        x.actual.trabajoSolicitado && `- Trabajo solicitado: ${x.actual.trabajoSolicitado}`,
      ]
        .filter(Boolean)
        .join('\n')}\n`
    : '';

  return `Sos el asistente de cotizaciones de ${e.nombre} (${e.lema}), una empresa de construcción en Costa Rica. Tu trabajo es ayudarme a armar una cotización completa, haciéndome preguntas, y al final darme un CÓDIGO que pego en nuestro sistema para que la cotización se llene sola.

Te puedo adjuntar un plano, un croquis o fotos del trabajo: si los adjunto, leelos con cuidado y usá sus medidas (confirmámelas en las preguntas).
${actual}
═══════════════ CÓMO HACER LAS PREGUNTAS ═══════════════
- Preguntá en rondas de 3 a 5 preguntas, en este orden: (1) cliente y trabajo, (2) medidas y alcance, (3) materiales y acabados, (4) precio y condiciones, (5) costos extras.
- Cada pregunta debe ser de SELECCIÓN MÚLTIPLE. Si tenés una herramienta para mostrar preguntas con opciones o botones, usala. Si no, escribilas numeradas con opciones A, B, C, D… y SIEMPRE una última opción "Otro (escribí tu respuesta)" para un detalle diferente.
- Yo voy a contestar rápido, por ejemplo: "1A, 2C, 3 Otro: con portón de 3 m".
- No preguntes lo que ya se ve en el plano o en lo que te dije: proponé el dato como opción A para que yo lo confirme.
- Antes del código, mostrame un resumen corto (partes, total aproximado) y preguntame si está bien.

═══════════════ CÓMO COTIZAMOS ═══════════════
- La cotización se divide en PARTES (por ejemplo: "Demolición", "Estructura", "Acabados"). Cada Parte tiene un nombre corto y renglones: UNA cosa por renglón, frases cortas, en orden de trabajo (como "A. Corte y armado de la estructura.").
- Modo de precio: "Partes + materiales" (cada Parte con su monto de mano de obra) o "Total a mano" (un solo total). Preferimos "Partes + materiales" cuando hay montos por Parte.
- Por defecto: adelanto ${porcentaje(d.porcentajeAdelanto)}, validez ${d.validezDias} días, garantía ${d.garantiaMeses} meses, horario ${d.horario}, los materiales los compra: ${d.quienCompraMateriales}, IVA ${porcentaje(d.iva)} solo si el cliente pide factura.
- Personal: ${e.personal || '—'}.
- Tipos de trabajo que usamos: ${x.ajustes.listas.tiposTrabajo.join(', ')}.
- COSTOS EXTRAS: transporte de material, pólizas (INS/riesgos del trabajo), alquiler de andamios o equipo, acarreo de escombros, viáticos, etc. Se le cobran al cliente pero normalmente NO se le muestran (van escondidos en el total). Preguntá si aplican y cuánto.

═══════════════ PRECIOS (usalos; NUNCA inventes un precio) ═══════════════
Mano de obra según nuestros servicios:
${servicios.length ? servicios.join('\n') : '- (todavía no hay servicios con precio: preguntame cuánto cobramos por cada Parte)'}

Materiales con precio (en colones):
${conPrecio.length ? conPrecio.map((m) => `- ${m.material} | ${m.unidad} | ${colones(m.precio)}`).join('\n') : '- (no hay materiales con precio)'}

Materiales del catálogo sin precio (usá el nombre igual, sin precio):
${sinPrecio.length ? sinPrecio.map((m) => `- ${m.material} (${m.unidad})`).join('\n') : '- (ninguno)'}

Si un trabajo o material no tiene precio aquí, preguntame cuánto cobramos (dame opciones de montos razonables en colones y "Otro").

═══════════════ EJEMPLOS DE CÓMO ESCRIBIMOS ═══════════════
${ejemplos(x.cotizaciones) || '(sin ejemplos todavía)'}

═══════════════ EL CÓDIGO FINAL ═══════════════
Cuando yo confirme el resumen, respondé con UN SOLO bloque \`\`\`json con exactamente esta forma (sin comentarios dentro del bloque):

\`\`\`json
{
  "${MARCA_CODIGO}": 1,
  "cliente": "Nombre del cliente",
  "telefono": "8888-8888",
  "ubicacion": "Grecia, Alajuela",
  "tipoTrabajo": "Uno de nuestros tipos de trabajo",
  "trabajoSolicitado": "Frase corta del trabajo",
  "detalleExtra": "",
  "modoPrecio": "Partes + materiales",
  "totalAMano": null,
  "quienCompraMateriales": "${d.quienCompraMateriales}",
  "mostrarMateriales": true,
  "cobrarIVA": false,
  "porcentajeAdelanto": ${Math.round(d.porcentajeAdelanto * 100)},
  "validezDias": ${d.validezDias},
  "garantiaMeses": ${d.garantiaMeses},
  "horario": "${d.horario}",
  "formaPagoEspecial": "",
  "partes": [
    { "nombre": "Estructura", "monto": 150000, "renglones": ["A. ...", "B. ..."], "renglonesOcultos": [] }
  ],
  "materiales": [
    { "material": "Nombre igual al catálogo", "cantidad": 10, "unidad": "unid", "precio": 3500, "clienteVe": true }
  ],
  "extras": [
    { "concepto": "Transporte de material", "monto": 25000, "clienteVe": false }
  ],
  "notas": ["Nota para el cliente, si hace falta"]
}
\`\`\`

Reglas del código:
- Montos en colones, números enteros, sin símbolos ni comas (150000, no "₡150,000").
- "porcentajeAdelanto" en porcentaje (50 = 50%). "monto" de cada Parte: mano de obra de esa Parte (null si es "Total a mano").
- "renglonesOcultos": renglones que cuentan pero el cliente no ve (normalmente vacío).
- Materiales: usá el nombre EXACTO del catálogo cuando exista; "cantidad" es número (o texto como "pendiente"); "precio" el de la lista (o el que yo te dije).
- Si después te pido cambios, devolvé el código COMPLETO otra vez.`;
}

// ---------------------------------------------------------------------------
// Leer el código que devuelve Claude
// ---------------------------------------------------------------------------

/** Saca el JSON del texto pegado (con o sin ```json, con texto antes o después). */
function extraerJson(texto: string): unknown {
  const bloque = /```(?:json)?\s*([\s\S]*?)```/i.exec(texto)?.[1];
  const candidatos = [bloque, texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1)].filter((t): t is string => !!t && t.includes('{'));
  for (const c of candidatos) {
    for (const intento of [c, c.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"')]) {
      try {
        return JSON.parse(intento);
      } catch {
        /* probar el siguiente */
      }
    }
  }
  throw new Error('No encontré el código. Copiá todo el bloque que empieza con { y termina con } (o el bloque ```json completo).');
}

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const numero = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[₡\s,]/g, ''));
    return v.trim() && Number.isFinite(n) ? n : null;
  }
  return null;
};

/**
 * Convierte el código en los datos de la cotización. Conserva el número, la fecha y las
 * fotos de la cotización abierta. Devuelve avisos de lo que conviene revisar.
 */
export function leerCodigo(
  pegado: string,
  base: DatosCotizacion,
  catalogo: Material[],
  categoriasGasto: string[],
): { datos: DatosCotizacion; avisos: string[] } {
  const j = extraerJson(pegado);
  if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('El código no tiene la forma esperada.');
  const o = j as Record<string, unknown>;
  if (!Array.isArray(o.partes) && !o.cliente && !Array.isArray(o.materiales)) throw new Error('El código no trae partes, materiales ni cliente: ¿es el código correcto?');
  const avisos: string[] = [];
  const porNombre = new Map(catalogo.map((m) => [m.material.toLowerCase(), m]));

  const partes = (Array.isArray(o.partes) ? o.partes : []).map((p: Record<string, unknown>) => ({
    nombre: texto(p?.nombre),
    monto: numero(p?.monto),
    renglones: [
      ...(Array.isArray(p?.renglones) ? p.renglones : []).map((r) => ({ texto: texto(r), clienteVe: true })),
      ...(Array.isArray(p?.renglonesOcultos) ? p.renglonesOcultos : []).map((r) => ({ texto: texto(r), clienteVe: false })),
    ].filter((r) => r.texto),
  }));

  let fuera = 0;
  const materiales = (Array.isArray(o.materiales) ? o.materiales : [])
    .filter((m: Record<string, unknown>) => texto(m?.material))
    .map((m: Record<string, unknown>) => {
      const cat = porNombre.get(texto(m.material).toLowerCase());
      const precio = numero(m.precio);
      if (!cat) fuera++;
      const cantidad = numero(m.cantidad) ?? (texto(m.cantidad) || null);
      return {
        material: cat?.material ?? texto(m.material),
        cantidad,
        unidad: cat && (!texto(m.unidad) || texto(m.unidad) === cat.unidad) ? '' : texto(m.unidad),
        // Si el precio es el mismo del catálogo, no hace falta "precio especial".
        precioEspecial: precio !== null && precio !== (cat?.precio ?? null) ? precio : null,
        clienteVe: m.clienteVe !== false,
      };
    });

  const extras = (Array.isArray(o.extras) ? o.extras : [])
    .filter((x: Record<string, unknown>) => texto(x?.concepto))
    .map((x: Record<string, unknown>) => ({
      concepto: texto(x.concepto),
      monto: numero(x.monto),
      categoria: categoriasGasto.includes(texto(x.categoria)) ? texto(x.categoria) : categoriaSugerida(texto(x.concepto), categoriasGasto),
      clienteVe: x.clienteVe === true,
    }));

  let adelanto = numero(o.porcentajeAdelanto);
  if (adelanto !== null && adelanto > 1) adelanto = adelanto / 100;

  const t = (k: string, def: string) => (typeof o[k] === 'string' ? texto(o[k]) : def);
  const datos = normalizarDatos({
    ...base,
    cliente: t('cliente', base.cliente),
    telefono: t('telefono', base.telefono),
    ubicacion: t('ubicacion', base.ubicacion),
    tipoTrabajo: t('tipoTrabajo', base.tipoTrabajo),
    trabajoSolicitado: t('trabajoSolicitado', base.trabajoSolicitado),
    detalleExtra: t('detalleExtra', base.detalleExtra),
    modoPrecio: o.modoPrecio === 'Total a mano' || o.modoPrecio === 'Partes + materiales' ? o.modoPrecio : base.modoPrecio,
    totalAMano: numero(o.totalAMano) ?? base.totalAMano,
    quienCompraMateriales: o.quienCompraMateriales === 'Arce Nuñez' || o.quienCompraMateriales === 'El cliente' ? o.quienCompraMateriales : base.quienCompraMateriales,
    mostrarMateriales: typeof o.mostrarMateriales === 'boolean' ? o.mostrarMateriales : base.mostrarMateriales,
    cobrarIVA: typeof o.cobrarIVA === 'boolean' ? o.cobrarIVA : base.cobrarIVA,
    porcentajeAdelanto: adelanto ?? base.porcentajeAdelanto,
    validezDias: numero(o.validezDias) ?? base.validezDias,
    garantiaMeses: numero(o.garantiaMeses) ?? base.garantiaMeses,
    horario: t('horario', base.horario),
    formaPagoEspecial: t('formaPagoEspecial', base.formaPagoEspecial),
    partes: partes.length ? partes : base.partes,
    materiales: Array.isArray(o.materiales) ? materiales : base.materiales,
    extras: Array.isArray(o.extras) ? extras : base.extras,
    notas: Array.isArray(o.notas) ? o.notas.map(texto).filter(Boolean) : base.notas,
  });

  if (!datos.cliente.trim()) avisos.push('Falta el nombre del cliente.');
  const sinMonto = datos.partes.filter((p) => p.nombre.trim() && p.monto === null).length;
  if (datos.modoPrecio === 'Partes + materiales' && sinMonto) avisos.push(`${sinMonto} ${sinMonto === 1 ? 'Parte no tiene' : 'Partes no tienen'} monto.`);
  if (datos.modoPrecio === 'Total a mano' && !datos.totalAMano) avisos.push('Está en "Total a mano" pero no trae el total.');
  if (fuera) avisos.push(`${fuera} ${fuera === 1 ? 'material no está' : 'materiales no están'} en el catálogo (se pueden agregar desde la cotización).`);
  return { datos, avisos };
}
