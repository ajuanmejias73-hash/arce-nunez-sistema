/**
 * Arma "lo que ve el cliente" a partir de los datos del editor, aplicando todas las
 * reglas de visibilidad (sección 4 y 5 de la especificación). El resultado es texto
 * listo para mostrar: se guarda tal cual en cada versión como su "foto fija".
 */
import { calcular, cantidadNumero, clausulasFinales, romano, type Calculo, type ClausulaFinal } from './cotizacion.ts';
import { colones, fecha, porcentaje } from './formato.ts';
import type { Ajustes, DatosCotizacion, Material } from './tipos.ts';

export interface ParVista {
  etiqueta: string;
  valor: string;
}

export interface ModeloVista {
  empresa: { nombre: string; lema: string; telefonos: string; responsable: string; correo: string; pie: string; logo: string };
  numero: string;
  fecha: string;
  validaHasta: string;
  cliente: string;
  datosCliente: ParVista[];
  mostrarMontos: boolean;
  partes: { etiqueta: string; nombre: string; renglones: string[]; monto: string }[];
  materiales: { conPrecios: boolean; filas: { material: string; cantidad: string; unidad: string; precio: string; total: string }[]; total: string } | null;
  notas: string[];
  fotos: string[];
  pagos: string[];
  desglose: ParVista[];
  total: string;
  ivaIncluido: boolean;
  adelantoSaldo: ParVista[];
  clausulas: ClausulaFinal[];
}

function cantidadTexto(c: DatosCotizacion['materiales'][number]['cantidad']): string {
  const n = cantidadNumero(c);
  if (n !== null) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return typeof c === 'string' ? c : '';
}

export function armarVista(d: DatosCotizacion, ajustes: Ajustes, catalogo: Material[]): { vista: ModeloVista; calculo: Calculo } {
  const c = calcular(d, catalogo, ajustes.porDefecto.iva);
  const e = ajustes.empresa;
  const porPartes = d.modoPrecio === 'Partes + materiales';
  const arceCompra = d.quienCompraMateriales === 'Arce Nuñez';
  const desglose = d.clienteVe.desglose;
  const especial = d.formaPagoEspecial.trim() !== '';

  const datosCliente: ParVista[] = [
    { etiqueta: 'Cliente', valor: d.cliente },
    { etiqueta: 'Teléfono', valor: d.telefono },
    { etiqueta: 'Ubicación', valor: d.ubicacion },
    { etiqueta: 'Tipo de trabajo', valor: d.tipoTrabajo },
    { etiqueta: 'Trabajo solicitado', valor: d.trabajoSolicitado },
    { etiqueta: 'Detalle', valor: d.detalleExtra },
  ].filter((p) => p.valor.trim());

  // Partes: numeradas en romanos solo las que tienen nombre.
  const mostrarMontos = porPartes && d.clienteVe.montoPartes;
  let n = 0;
  const partes: ModeloVista['partes'] = [];
  for (const p of d.partes) {
    const nombre = p.nombre.trim();
    const etiqueta = nombre ? `PARTE ${romano(++n)}` : '';
    const renglones = p.renglones.filter((r) => r.clienteVe && r.texto.trim()).map((r) => r.texto.trim());
    if (!nombre && !renglones.length) continue;
    partes.push({ etiqueta, nombre, renglones, monto: mostrarMontos && p.monto !== null ? colones(p.monto) : '' });
  }

  // Materiales.
  const conPrecios = porPartes && arceCompra && d.clienteVe.preciosMateriales;
  const filasVisibles = c.filas.filter((f) => f.clienteVe);
  const materiales =
    d.mostrarMateriales && filasVisibles.length
      ? {
          conPrecios,
          filas: filasVisibles.map((f) => ({
            material: f.material,
            cantidad: cantidadTexto(f.cantidad),
            unidad: f.unidadFinal,
            precio: conPrecios && f.precioUsado !== null ? colones(f.precioUsado) : '',
            total: conPrecios && f.total !== null ? colones(f.total) : '',
          })),
          total: conPrecios ? colones(c.materiales) : '',
        }
      : null;

  // Monto en colones.
  const pagos = [
    e.sinpe ? `SINPE Móvil ${e.sinpe}${e.responsable ? ' · ' + e.responsable : ''}` : '',
    'Efectivo o transferencia bancaria (solicite los datos)',
    especial ? 'Ver «Forma de pago» en las condiciones' : `Adelanto requerido: ${porcentaje(d.porcentajeAdelanto)} al iniciar la obra`,
  ].filter(Boolean);

  const lineas: ParVista[] = [];
  const extrasVisibles = (d.extras ?? []).filter((x) => x.clienteVe && (x.monto ?? 0) > 0);
  // El descuento sale solo de la mano de obra (o del trabajo): va justo debajo de esa línea.
  // Siempre se muestra, aunque el desglose esté escondido, para que el cliente lo vea.
  const conDescuento = c.descuento > 0;
  const lineaDescuento = { etiqueta: `${porPartes ? 'Descuento en mano de obra' : 'Descuento'} (${porcentaje(c.descuentoPct)})`, valor: '−' + colones(c.descuento) };
  // Los extras que el cliente no ve van dentro de "Mano de obra" (o del trabajo) para que la suma cuadre.
  if (desglose && porPartes) {
    lineas.push({ etiqueta: 'Mano de obra', valor: colones(c.manoDeObra + c.extrasOcultos) });
    if (conDescuento) lineas.push(lineaDescuento);
  }
  if (desglose && porPartes && arceCompra) lineas.push({ etiqueta: 'Materiales', valor: colones(c.materiales) });
  if (desglose && !porPartes && extrasVisibles.length) {
    lineas.push({ etiqueta: 'Trabajo', valor: colones(c.baseDescuento) });
    if (conDescuento) lineas.push(lineaDescuento);
  }
  if (desglose) for (const x of extrasVisibles) lineas.push({ etiqueta: x.concepto, valor: colones(x.monto ?? 0) });
  if (conDescuento && !(desglose && (porPartes || extrasVisibles.length))) {
    lineas.push({ etiqueta: 'Precio', valor: colones(c.subtotal) });
    lineas.push(lineaDescuento);
  }
  if (desglose || conDescuento) lineas.push({ etiqueta: 'Subtotal', valor: colones(c.subtotal - c.descuento) });
  if ((desglose || conDescuento) && d.cobrarIVA) lineas.push({ etiqueta: `IVA ${porcentaje(ajustes.porDefecto.iva)}`, valor: colones(c.iva) });

  const adelantoSaldo: ParVista[] =
    d.clienteVe.adelantoSaldo && !especial
      ? [
          { etiqueta: `Adelanto (${porcentaje(d.porcentajeAdelanto)})`, valor: colones(c.adelanto) },
          { etiqueta: `Saldo al finalizar (${porcentaje(1 - d.porcentajeAdelanto)})`, valor: colones(c.saldo) },
        ]
      : [];

  return {
    calculo: c,
    vista: {
      empresa: { nombre: e.nombre, lema: e.lema, telefonos: e.telefonos, responsable: e.responsable, correo: e.correo, pie: e.pie, logo: e.logo },
      numero: d.numero,
      fecha: fecha(d.fecha),
      validaHasta: fecha(c.validaHasta),
      cliente: d.cliente.trim(),
      datosCliente,
      mostrarMontos: mostrarMontos && partes.some((p) => p.monto),
      partes,
      materiales,
      notas: d.notas.map((x) => x.trim()).filter(Boolean),
      fotos: d.fotos.slice(0, 9),
      pagos,
      desglose: lineas,
      total: colones(c.total),
      ivaIncluido: d.cobrarIVA,
      adelantoSaldo,
      clausulas: clausulasFinales(ajustes.clausulas, d, c, ajustes),
    },
  };
}

/** Nombre de archivo: "Cotización COT-0008 - Cliente". Sin caracteres que Windows no acepta. */
export function nombreArchivo(numero: string, cliente: string): string {
  return `Cotización ${numero} - ${cliente}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
}
