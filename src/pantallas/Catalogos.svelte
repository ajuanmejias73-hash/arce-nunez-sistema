<script lang="ts">
  import { datos, type Clave } from '../lib/datos.svelte.ts';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { sesion } from '../lib/sesion.svelte.ts';
  import { FORMAS_COBRO, type Listas } from '../lib/tipos.ts';
  import TablaRegistros, { type Columna } from '../componentes/TablaRegistros.svelte';
  import ListaSimple, { type Elemento } from '../componentes/ListaSimple.svelte';

  type ListaTexto = Exclude<keyof Listas, 'estados'>;

  const PESTANAS = [
    { id: 'materiales', nombre: 'Materiales' },
    { id: 'servicios', nombre: 'Servicios' },
    { id: 'trabajadores', nombre: 'Trabajadores' },
    { id: 'tiposTrabajo', nombre: 'Tipos de trabajo' },
    { id: 'unidades', nombre: 'Unidades' },
    { id: 'categoriasMaterial', nombre: 'Categorías de material' },
    { id: 'estados', nombre: 'Estados de cotización' },
    { id: 'categoriasGasto', nombre: 'Categorías de gasto' },
    { id: 'categoriasIngreso', nombre: 'Categorías de ingreso' },
    { id: 'metodosPago', nombre: 'Métodos de pago' },
  ] as const;

  let pestana = $state<(typeof PESTANAS)[number]['id']>('materiales');

  const c = $derived(datos.c!);
  const listas = $derived(c.ajustes.listas);

  const colMateriales = $derived<Columna[]>([
    { campo: 'material', titulo: 'Material', tipo: 'texto' },
    { campo: 'unidad', titulo: 'Unidad', tipo: 'opciones', opciones: listas.unidades, obligatorio: true },
    { campo: 'precio', titulo: 'Precio', tipo: 'dinero' },
    { campo: 'categoria', titulo: 'Categoría', tipo: 'opciones', opciones: listas.categoriasMaterial },
    { campo: 'notas', titulo: 'Notas', tipo: 'texto' },
  ]);

  const colServicios = $derived<Columna[]>([
    { campo: 'servicio', titulo: 'Servicio', tipo: 'texto' },
    { campo: 'descripcion', titulo: 'Descripción', tipo: 'texto' },
    { campo: 'formaCobro', titulo: 'Forma de cobro', tipo: 'opciones', opciones: [...FORMAS_COBRO], obligatorio: true },
    { campo: 'precio', titulo: 'Precio', tipo: 'dinero' },
    { campo: 'tipoTrabajo', titulo: 'Tipo de trabajo', tipo: 'opciones', opciones: listas.tiposTrabajo },
    { campo: 'notas', titulo: 'Notas', tipo: 'texto' },
  ]);

  const colTrabajadores: Columna[] = [
    { campo: 'nombre', titulo: 'Nombre', tipo: 'texto' },
    { campo: 'puesto', titulo: 'Puesto', tipo: 'texto' },
    { campo: 'valorHora', titulo: 'Valor por hora', tipo: 'dinero' },
    { campo: 'telefono', titulo: 'Teléfono', tipo: 'texto' },
  ];

  const firma = () => ({ modificadoPor: sesion.quien, modificado: new Date().toISOString() });

  async function intentar(accion: () => Promise<void>, ok: string): Promise<boolean> {
    try {
      await accion();
      dialogos.avisar(ok);
      return true;
    } catch (e) {
      dialogos.fallo(e);
      return false;
    }
  }

  /** Guarda un registro de un catálogo (materiales, servicios o trabajadores). */
  function guardarRegistro(clave: Clave & ('materiales' | 'servicios' | 'trabajadores'), campo: string, etiqueta: string) {
    return (original: string | null, nuevo: Record<string, unknown>) =>
      intentar(
        () =>
          datos.modificar(
            clave,
            (lista) => {
              const l = lista as unknown as Record<string, unknown>[];
              const nombre = String(nuevo[campo]).toLowerCase();
              const i = original === null ? -1 : l.findIndex((x) => x[campo] === original);
              if (l.some((x, j) => j !== i && String(x[campo]).toLowerCase() === nombre)) throw new Error(`ya existe «${nuevo[campo]}».`);
              const registro = { ...nuevo, ...firma() };
              if (i >= 0) l[i] = registro;
              else l.push(registro);
            },
            original === null ? `agregó ${etiqueta} «${nuevo[campo]}»` : `editó ${etiqueta} «${nuevo[campo]}»`,
            sesion.quien,
          ),
        'Guardado',
      );
  }

  function borrarRegistro(clave: Clave & ('materiales' | 'servicios' | 'trabajadores'), campo: string, etiqueta: string) {
    return (nombre: string) =>
      intentar(
        () =>
          datos.modificar(
            clave,
            (lista) => (lista as unknown as Record<string, unknown>[]).filter((x) => x[campo] !== nombre) as never,
            `borró ${etiqueta} «${nombre}»`,
            sesion.quien,
          ),
        'Borrado',
      );
  }

  /** Listas de nombres guardadas en Ajustes. */
  function guardarEnLista(lista: ListaTexto) {
    return (original: string | null, nuevo: Elemento) =>
      intentar(
        () =>
          datos.modificar(
            'ajustes',
            (a) => {
              const l = a.listas[lista];
              if (l.some((x) => x.toLowerCase() === nuevo.nombre.toLowerCase() && x !== original)) throw new Error(`ya existe «${nuevo.nombre}».`);
              const i = original === null ? -1 : l.indexOf(original);
              if (i >= 0) l[i] = nuevo.nombre;
              else l.push(nuevo.nombre);
            },
            `${original === null ? 'agregó' : 'editó'} «${nuevo.nombre}» en ${nombreLista(lista)}`,
            sesion.quien,
          ),
        'Guardado',
      );
  }

  function borrarDeLista(lista: ListaTexto) {
    return (nombre: string) =>
      intentar(
        () =>
          datos.modificar(
            'ajustes',
            (a) => void (a.listas[lista] = a.listas[lista].filter((x) => x !== nombre)),
            `borró «${nombre}» de ${nombreLista(lista)}`,
            sesion.quien,
          ),
        'Borrado',
      );
  }

  function guardarEstado(original: string | null, nuevo: Elemento) {
    return intentar(
      () =>
        datos.modificar(
          'ajustes',
          (a) => {
            const l = a.listas.estados;
            if (l.some((x) => x.nombre.toLowerCase() === nuevo.nombre.toLowerCase() && x.nombre !== original)) throw new Error(`ya existe «${nuevo.nombre}».`);
            const e = { nombre: nuevo.nombre, color: nuevo.color ?? '#7a7266' };
            const i = original === null ? -1 : l.findIndex((x) => x.nombre === original);
            if (i >= 0) l[i] = e;
            else l.push(e);
          },
          `${original === null ? 'agregó' : 'editó'} el estado «${nuevo.nombre}»`,
          sesion.quien,
        ),
      'Guardado',
    );
  }

  function borrarEstado(nombre: string) {
    if (c.ajustes.listas.estados.length <= 1) {
      dialogos.avisar('Tiene que quedar al menos un estado.', 'error');
      return Promise.resolve(false);
    }
    return intentar(
      () => datos.modificar('ajustes', (a) => void (a.listas.estados = a.listas.estados.filter((x) => x.nombre !== nombre)), `borró el estado «${nombre}»`, sesion.quien),
      'Borrado',
    );
  }

  function nombreLista(id: string) {
    return PESTANAS.find((p) => p.id === id)?.nombre.toLowerCase() ?? id;
  }

  const listaActual = $derived(pestana as ListaTexto);
</script>

<h1>Catálogos y listas</h1>
<p class="ayuda">Lo que se agrega aquí aparece de inmediato en las listas del Panel, la Calculadora y la Contabilidad.</p>

<div class="pestanas" role="tablist" aria-label="Catálogos">
  {#each PESTANAS as p}
    <button role="tab" aria-selected={pestana === p.id} class:activa={pestana === p.id} onclick={() => (pestana = p.id)}>{p.nombre}</button>
  {/each}
</div>

<section class="tarjeta" role="tabpanel">
  {#key pestana}
    {#if pestana === 'materiales'}
      <TablaRegistros
        registros={c.materiales as never}
        columnas={colMateriales}
        nombreSingular="material"
        guardar={guardarRegistro('materiales', 'material', 'el material')}
        borrar={borrarRegistro('materiales', 'material', 'el material')}
      />
    {:else if pestana === 'servicios'}
      <TablaRegistros
        registros={c.servicios as never}
        columnas={colServicios}
        nombreSingular="servicio"
        guardar={guardarRegistro('servicios', 'servicio', 'el servicio')}
        borrar={borrarRegistro('servicios', 'servicio', 'el servicio')}
      />
    {:else if pestana === 'trabajadores'}
      <TablaRegistros
        registros={c.trabajadores as never}
        columnas={colTrabajadores}
        nombreSingular="trabajador"
        guardar={guardarRegistro('trabajadores', 'nombre', 'al trabajador')}
        borrar={borrarRegistro('trabajadores', 'nombre', 'al trabajador')}
      />
      <p class="ayuda">Las horas y los pagos de cada trabajador se llevan en Planilla.</p>
    {:else if pestana === 'estados'}
      <ListaSimple elementos={listas.estados} conColor guardar={guardarEstado} borrar={borrarEstado} />
    {:else}
      <ListaSimple
        elementos={listas[listaActual].map((nombre) => ({ nombre }))}
        guardar={guardarEnLista(listaActual)}
        borrar={borrarDeLista(listaActual)}
      />
    {/if}
  {/key}
</section>

<style>
  .pestanas {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 6px;
    margin: 14px 0 12px;
    scrollbar-width: thin;
  }
  .pestanas button {
    flex: 0 0 auto;
    background: var(--blanco);
    border: 1px solid var(--linea);
    font-weight: 500;
    padding: 7px 14px;
    min-height: 38px;
    border-radius: 999px;
  }
  .pestanas button.activa {
    background: var(--carbon);
    color: var(--dorado-claro);
    border-color: var(--carbon);
    font-weight: 700;
  }
</style>
