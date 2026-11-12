/** Tipos de los datos que se guardan en el repositorio privado (mismo formato que datos_iniciales). */

export interface Empresa {
  nombre: string;
  lema: string;
  telefonos: string;
  responsable: string;
  sinpe: string;
  correo: string;
  personal: string;
  pie: string;
  /** Ruta del logo dentro del repositorio de datos (ej. "logo.png"). */
  logo: string;
}

export interface Usuario {
  nombre: string;
  pin: string;
}

export type ModoPrecio = 'Total a mano' | 'Partes + materiales';
export type QuienCompra = 'El cliente' | 'Arce Nuñez';

export interface PorDefecto {
  modoPrecio: ModoPrecio;
  /** Fracción: 0.5 = 50 %. */
  porcentajeAdelanto: number;
  /** Fracción: 0.13 = 13 %. */
  iva: number;
  validezDias: number;
  garantiaMeses: number;
  horario: string;
  quienCompraMateriales: QuienCompra;
  prefijo: string;
}

export interface Estado {
  nombre: string;
  color: string;
}

export interface Listas {
  tiposTrabajo: string[];
  estados: Estado[];
  unidades: string[];
  categoriasMaterial: string[];
  categoriasGasto: string[];
  categoriasIngreso: string[];
  metodosPago: string[];
}

export type CondicionClausula = '' | 'MATERIALES' | 'IVA' | 'PAGO';

export interface Clausula {
  titulo: string;
  texto: string;
  alternativo: string;
  condicion: CondicionClausula;
}

export interface Mezcla {
  tipo: string;
  cemento: number;
  arena: number;
  piedra: number;
  agua: number;
}

export interface Ajustes {
  empresa: Empresa;
  usuarios: Usuario[];
  porDefecto: PorDefecto;
  listas: Listas;
  clausulas: Clausula[];
  rendimientos: Record<string, number>;
  mezclas: Mezcla[];
}

/** Marca de quién y cuándo cambió un registro. */
export interface Firma {
  modificadoPor?: string;
  modificado?: string;
}

export interface Material extends Firma {
  material: string;
  unidad: string;
  precio: number | null;
  categoria: string;
  notas: string;
}

export const FORMAS_COBRO = ['Por hora', 'Por m²', 'Por metro lineal', 'Por día', 'Precio fijo'] as const;
export type FormaCobro = (typeof FORMAS_COBRO)[number];

export interface Servicio extends Firma {
  servicio: string;
  descripcion: string;
  formaCobro: FormaCobro;
  precio: number | null;
  tipoTrabajo: string;
  notas: string;
}

export interface Trabajador extends Firma {
  nombre: string;
  puesto: string;
  valorHora: number | null;
  telefono: string;
}

// ---------------------------------------------------------------------------
// Cotizaciones
// ---------------------------------------------------------------------------

export interface Renglon {
  texto: string;
  clienteVe: boolean;
}

export interface Parte {
  nombre: string;
  monto: number | null;
  renglones: Renglon[];
}

export interface FilaMaterial {
  material: string;
  /** Número o texto ("pendiente", "el cliente define"…). */
  cantidad: number | string | null;
  /** Vacía = la del catálogo. */
  unidad: string;
  precioEspecial: number | null;
  clienteVe: boolean;
}

export interface ClienteVe {
  montoPartes: boolean;
  preciosMateriales: boolean;
  desglose: boolean;
  adelantoSaldo: boolean;
}

/** Todo lo que se escribe en el editor de una cotización. */
export interface DatosCotizacion {
  numero: string;
  fecha: string;
  cliente: string;
  telefono: string;
  ubicacion: string;
  tipoTrabajo: string;
  trabajoSolicitado: string;
  detalleExtra: string;
  modoPrecio: ModoPrecio;
  totalAMano: number | null;
  cobrarIVA: boolean;
  porcentajeAdelanto: number;
  quienCompraMateriales: QuienCompra;
  mostrarMateriales: boolean;
  validezDias: number;
  garantiaMeses: number;
  horario: string;
  formaPagoEspecial: string;
  clienteVe: ClienteVe;
  partes: Parte[];
  materiales: FilaMaterial[];
  notas: string[];
  /** Rutas de las fotos dentro del repositorio de datos. */
  fotos: string[];
}

export interface Version {
  version: number;
  guardado: string;
  guardadoPor: string;
  queCambio: string;
  total: number;
  adelanto: number;
  datos: DatosCotizacion;
  /** "Foto fija": la cotización tal como quedó ese día (aunque luego cambien Ajustes o el Catálogo). */
  vista?: unknown;
  /** Ruta del PDF guardado de esta versión. */
  pdf?: string;
}

export interface Cotizacion {
  numero: string;
  cliente: string;
  estado: string;
  versionActual: number;
  versiones: Version[];
  /** Notas para Pablo y Lin (el cliente nunca las ve). */
  notasInternas?: string;
  /** Quién cambió el estado por última vez, y cuándo. */
  estadoPor?: string;
  estadoFecha?: string;
}

// ---------------------------------------------------------------------------
// Contabilidad
// ---------------------------------------------------------------------------

export type TipoMovimiento = 'Ingreso' | 'Gasto';

export interface Movimiento {
  id: string;
  fecha: string;
  tipo: TipoMovimiento;
  categoria: string;
  descripcion: string;
  /** N.º de cotización (la obra); '' si no es de ninguna. */
  cotizacion: string;
  /** Cliente, proveedor o trabajador. */
  persona: string;
  metodo: string;
  /** Siempre positivo. */
  monto: number;
  comprobante: string;
  notas: string;
  registradoPor: string;
  registrado: string;
  /** Si salió de "Pagar planilla": el pago al que pertenece. */
  pagoPlanilla?: string;
}

export interface Hora {
  id: string;
  fecha: string;
  trabajador: string;
  cotizacion: string;
  horas: number;
  valorHora: number;
  pagado: boolean;
  fechaPago: string;
  notas: string;
  registradoPor: string;
  registrado: string;
  pagoPlanilla?: string;
}
