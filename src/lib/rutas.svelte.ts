/** Navegación entre pantallas con la dirección (#/ajustes, #/catalogos…). */

export type Grupo = 'Cotizaciones' | 'Dinero' | 'Configuración';

export interface Modulo {
  ruta: string;
  nombre: string;
  descripcion: string;
  grupo: Grupo;
  /** Etapa en la que se construye (las pendientes se muestran como "Próximamente"). */
  etapa: number;
}

export const GRUPOS: Grupo[] = ['Cotizaciones', 'Dinero', 'Configuración'];

export const MODULOS: Modulo[] = [
  { ruta: 'nueva', nombre: '+ Nueva cotización', descripcion: 'Para un cliente nuevo o uno que ya tiene cotizaciones', grupo: 'Cotizaciones', etapa: 2 },
  { ruta: 'modificar', nombre: 'Modificar cotización', descripcion: 'Escoger una guardada y hacerle cambios (queda como v2, v3…)', grupo: 'Cotizaciones', etapa: 2 },
  { ruta: 'historial', nombre: 'Historial', descripcion: 'Todas las cotizaciones, su estado y sus versiones', grupo: 'Cotizaciones', etapa: 3 },
  { ruta: 'calculadora', nombre: 'Calculadora', descripcion: 'Materiales y mano de obra de una obra', grupo: 'Cotizaciones', etapa: 4 },
  { ruta: 'contabilidad', nombre: 'Contabilidad', descripcion: 'Resumen del mes, del año y por obra', grupo: 'Dinero', etapa: 5 },
  { ruta: 'movimientos', nombre: 'Pagos y gastos', descripcion: 'Pagos de clientes y gastos', grupo: 'Dinero', etapa: 5 },
  { ruta: 'planilla', nombre: 'Planilla', descripcion: 'Trabajadores y horas', grupo: 'Dinero', etapa: 5 },
  { ruta: 'catalogos', nombre: 'Catálogos y listas', descripcion: 'Materiales, servicios y todas las listas', grupo: 'Configuración', etapa: 1 },
  { ruta: 'ajustes', nombre: 'Ajustes', descripcion: 'Empresa, valores por defecto, cláusulas, PIN y respaldo', grupo: 'Configuración', etapa: 1 },
  { ruta: 'guia', nombre: 'Guía', descripcion: 'Cómo se usa el sistema', grupo: 'Configuración', etapa: 5 },
];

/** Etapa que ya está construida. */
export const ETAPA_ACTUAL = 5;

function leerRuta(): string {
  return location.hash.replace(/^#\/?/, '').split('?')[0] || 'inicio';
}

class Rutas {
  actual = $state(leerRuta());

  constructor() {
    window.addEventListener('hashchange', () => {
      this.actual = leerRuta();
      window.scrollTo(0, 0);
    });
  }

  ir(ruta: string): void {
    location.hash = ruta === 'inicio' ? '/' : '/' + ruta;
  }
}

export const rutas = new Rutas();
