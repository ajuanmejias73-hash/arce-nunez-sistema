<script lang="ts">
  /** Proveedores (ej. Vidrios Arias): contacto, productos con precio, pagos y dónde se usaron. */
  import { claveNombre, numeroWhatsApp, proveedorEnUso, resumenProveedor, telefonos } from '../lib/contactos.ts';
  import { ultimaVersion } from '../lib/cotizacion.ts';
  import { datos } from '../lib/datos.svelte.ts';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { colones, fecha } from '../lib/formato.ts';
  import { rutas } from '../lib/rutas.svelte.ts';
  import { sesion } from '../lib/sesion.svelte.ts';
  import type { ProductoProveedor, Proveedor } from '../lib/tipos.ts';
  import FormMovimiento from '../componentes/FormMovimiento.svelte';
  import TablaRegistros, { type Columna } from '../componentes/TablaRegistros.svelte';
  import Ventana from '../componentes/Ventana.svelte';

  const c = $derived(datos.c!);
  const lista = $derived([...c.proveedores].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
  const nombreAbierto = $derived(rutas.actual.startsWith('proveedores/') ? decodeURIComponent(rutas.actual.slice('proveedores/'.length)) : null);
  const abierto = $derived(nombreAbierto === null ? null : (lista.find((p) => claveNombre(p.nombre) === claveNombre(nombreAbierto)) ?? null));
  const resumen = $derived(abierto ? resumenProveedor(abierto, c.cotizaciones, c.movimientos) : null);

  let buscar = $state('');
  const filtrados = $derived.by(() => {
    const q = buscar.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((p) => [p.nombre, p.contacto, p.telefono, p.queVende, ...p.productos.map((x) => x.producto)].some((v) => v.toLowerCase().includes(q)));
  });

  const abrir = (nombre: string) => rutas.ir('proveedores/' + encodeURIComponent(nombre));
  const firma = () => ({ modificadoPor: sesion.quien, modificado: new Date().toISOString() });

  // ---- Ficha (agregar / editar) ----
  type Datos = Omit<Proveedor, 'productos' | 'modificadoPor' | 'modificado'>;
  const VACIA: Datos = { nombre: '', contacto: '', telefono: '', correo: '', queVende: '', notas: '' };
  let ficha = $state<Datos>({ ...VACIA });
  let editando = $state<string | null>(null);
  let guardando = $state(false);
  const nombreFijo = $derived(!!editando && proveedorEnUso(editando, c.cotizaciones, c.movimientos));

  function nuevo() {
    ficha = { ...VACIA };
    editando = '';
  }

  function editar(p: Proveedor) {
    ficha = { nombre: p.nombre, contacto: p.contacto, telefono: p.telefono, correo: p.correo, queVende: p.queVende, notas: p.notas };
    editando = p.nombre;
  }

  async function guardar(ev: SubmitEvent) {
    ev.preventDefault();
    const nombre = ficha.nombre.trim();
    if (!nombre) return dialogos.avisar('Falta el nombre.', 'error');
    const original = editando ?? '';
    const esNuevo = original === '';
    if (claveNombre(nombre) !== claveNombre(original) && lista.some((p) => claveNombre(p.nombre) === claveNombre(nombre))) {
      return dialogos.avisar(`Ya existe el proveedor «${nombre}».`, 'error');
    }
    guardando = true;
    try {
      const datosFicha = {
        nombre,
        contacto: ficha.contacto.trim(),
        telefono: ficha.telefono.trim(),
        correo: ficha.correo.trim(),
        queVende: ficha.queVende.trim(),
        notas: ficha.notas.trim(),
        ...firma(),
      };
      await datos.modificar(
        'proveedores',
        (l) => {
          const i = esNuevo ? -1 : l.findIndex((p) => claveNombre(p.nombre) === claveNombre(original));
          if (i >= 0) l[i] = { ...l[i], ...datosFicha };
          else l.push({ ...datosFicha, productos: [] });
        },
        esNuevo ? `agregó al proveedor «${nombre}»` : `editó al proveedor «${nombre}»`,
        sesion.quien,
      );
      editando = null;
      dialogos.avisar(esNuevo ? 'Guardado. Ahora agregale sus productos con precio.' : 'Guardado');
      if (esNuevo || claveNombre(nombre) !== claveNombre(original)) abrir(nombre);
    } catch (e) {
      dialogos.fallo(e);
    } finally {
      guardando = false;
    }
  }

  async function borrar(p: Proveedor) {
    const usado = proveedorEnUso(p.nombre, c.cotizaciones, c.movimientos);
    const texto = usado ? 'Ya se usó en cotizaciones o gastos: esos no cambian, pero ya no va a salir en la lista.' : 'Se borran también sus productos.';
    if (!(await dialogos.confirmar(`¿Borrar a «${p.nombre}»?`, texto, { si: 'Borrar', peligro: true }))) return;
    try {
      await datos.modificar('proveedores', (l) => l.filter((x) => claveNombre(x.nombre) !== claveNombre(p.nombre)), `borró al proveedor «${p.nombre}»`, sesion.quien);
      dialogos.avisar('Borrado');
      rutas.ir('proveedores');
    } catch (e) {
      dialogos.fallo(e);
    }
  }

  // ---- Productos del proveedor abierto ----
  const colProductos = $derived<Columna[]>([
    { campo: 'producto', titulo: 'Producto', tipo: 'texto' },
    { campo: 'unidad', titulo: 'Unidad', tipo: 'opciones', opciones: c.ajustes.listas.unidades, obligatorio: true },
    { campo: 'precio', titulo: 'Precio del proveedor', tipo: 'dinero' },
    { campo: 'notas', titulo: 'Notas', tipo: 'texto' },
  ]);

  function cambiarProductos(cambio: (productos: ProductoProveedor[]) => ProductoProveedor[], mensaje: string) {
    const nombre = abierto!.nombre;
    return datos
      .modificar(
        'proveedores',
        (l) => {
          const p = l.find((x) => claveNombre(x.nombre) === claveNombre(nombre));
          if (!p) throw new Error('ese proveedor ya no existe.');
          p.productos = cambio(p.productos);
          Object.assign(p, firma());
        },
        mensaje,
        sesion.quien,
      )
      .then(() => (dialogos.avisar('Guardado'), true))
      .catch((e) => (dialogos.fallo(e), false));
  }

  function guardarProducto(original: string | null, nuevo: Record<string, unknown>) {
    const producto = nuevo as unknown as ProductoProveedor;
    return cambiarProductos(
      (ps) => {
        if (ps.some((x) => x.producto.toLowerCase() === producto.producto.toLowerCase() && x.producto !== original)) throw new Error(`ya existe «${producto.producto}».`);
        const i = original === null ? -1 : ps.findIndex((x) => x.producto === original);
        if (i >= 0) ps[i] = producto;
        else ps.push(producto);
        return ps;
      },
      `${original === null ? 'agregó' : 'editó'} «${producto.producto}» de ${abierto!.nombre}`,
    );
  }

  function borrarProducto(nombre: string) {
    return cambiarProductos((ps) => ps.filter((x) => x.producto !== nombre), `borró «${nombre}» de ${abierto!.nombre}`);
  }

  let pagando = $state(false);
</script>

{#if nombreAbierto === null}
  <h1>Proveedores</h1>
  <p class="ayuda">Los que les cotizan aparte (vidrios, ventanas, portones…). Sus productos se escogen en la cotización, en Materiales.</p>

  <div class="herramientas">
    <input type="search" bind:value={buscar} placeholder="Buscar proveedor o producto…" aria-label="Buscar proveedor" />
    <button class="btn-dorado" onclick={nuevo}>+ Agregar proveedor</button>
  </div>

  <ul class="lista">
    {#each filtrados as p (p.nombre)}
      <li>
        <button class="tarjeta fila" onclick={() => abrir(p.nombre)}>
          <strong>{p.nombre}</strong>
          <span>{p.queVende || 'Sin descripción'}</span>
          <small>{[p.contacto, p.telefono].filter(Boolean).join(' · ') || 'Sin contacto'} · {p.productos.length} {p.productos.length === 1 ? 'producto' : 'productos'}</small>
        </button>
      </li>
    {:else}
      <li class="vacio">{buscar ? 'Ningún proveedor coincide.' : 'Todavía no hay proveedores. Tocá "+ Agregar proveedor" (por ejemplo, Vidrios Arias).'}</li>
    {/each}
  </ul>
{:else if !abierto || !resumen}
  <h1>Proveedor no encontrado</h1>
  <p>No hay ningún proveedor «{nombreAbierto}».</p>
  <button class="btn-borde" onclick={() => rutas.ir('proveedores')}>← Volver a Proveedores</button>
{:else}
  {@const p = abierto}
  <button class="volver btn-borde btn-chico" onclick={() => rutas.ir('proveedores')}>← Proveedores</button>
  <h1>{p.nombre}</h1>
  {#if p.queVende}<p class="ayuda">{p.queVende}</p>{/if}

  <div class="dos">
    <section class="tarjeta">
      <div class="tarjeta-titulo">
        <h2>Datos</h2>
        <div class="acciones">
          <button class="btn-borde btn-chico" onclick={() => editar(p)}>Editar</button>
          <button class="btn-peligro btn-chico" onclick={() => borrar(p)}>Borrar</button>
        </div>
      </div>
      <dl>
        <dt>Contacto</dt><dd>{p.contacto || '—'}</dd>
        <dt>Teléfono</dt><dd>{p.telefono || '—'}</dd>
        <dt>Correo</dt><dd>{p.correo || '—'}</dd>
        {#if p.notas}<dt>Notas</dt><dd class="notas">{p.notas}</dd>{/if}
      </dl>
      <div class="acciones">
        {#each telefonos(p.telefono).slice(0, 2) as t}
          <a class="btn-borde btn-chico" href="tel:{t.replace(/[\s-]/g, '')}">📞 Llamar {t}</a>
          <a class="btn-borde btn-chico" href="https://wa.me/{numeroWhatsApp(t)}" target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>
        {/each}
      </div>
    </section>

    <section class="tarjeta">
      <div class="tarjeta-titulo">
        <h2>Pagos</h2>
        <button class="btn btn-chico" onclick={() => (pagando = true)}>+ Registrar pago</button>
      </div>
      <p class="pagado">Se le ha pagado <strong>{colones(resumen.pagado)}</strong></p>
      <ul class="movs">
        {#each resumen.gastos.slice(0, 8) as m (m.id)}
          <li>
            <span>{fecha(m.fecha)} · {m.descripcion || m.categoria}{m.cotizacion ? ` (${m.cotizacion})` : ''}{m.estimado ? ' · estimado' : ''}</span>
            <strong>{colones(m.monto)}</strong>
          </li>
        {:else}
          <li class="ayuda">Todavía no hay gastos a su nombre.</li>
        {/each}
      </ul>
      {#if resumen.gastos.length > 8}<p class="ayuda">Y {resumen.gastos.length - 8} más en Pagos y gastos.</p>{/if}
    </section>
  </div>

  <section class="tarjeta">
    <h2>Productos y precios</h2>
    <p class="ayuda">El precio es lo que cobra el proveedor. En la cotización le podés sumar un % de ganancia cuando haga falta.</p>
    <TablaRegistros registros={p.productos as never} columnas={colProductos} nombreSingular="producto" guardar={guardarProducto} borrar={borrarProducto} />
  </section>

  <section class="tarjeta">
    <h2>Cotizaciones donde se usó</h2>
    {#each resumen.cotizaciones as q (q.numero)}
      <p class="usada">
        <a href="#/ver/{encodeURIComponent(q.numero)}">{q.numero}</a> · {q.cliente} · {q.estado} · {fecha(ultimaVersion(q).datos.fecha)}
      </p>
    {:else}
      <p class="vacio">Todavía no se ha usado en ninguna cotización.</p>
    {/each}
  </section>

  <Ventana abierta={pagando} titulo="Registrar pago a {p.nombre}" cerrar={() => (pagando = false)}>
    <FormMovimiento tipo="Gasto" persona={p.nombre} listo={() => (pagando = false)} />
  </Ventana>
{/if}

<Ventana abierta={editando !== null} titulo={editando ? `Editar a ${editando}` : 'Agregar proveedor'} cerrar={() => (editando = null)}>
  <form onsubmit={guardar}>
    <div class="campos">
      <label class="ancho">
        Nombre
        <input bind:value={ficha.nombre} disabled={nombreFijo} required placeholder="Vidrios Arias" />
        {#if nombreFijo}<span class="ayuda">El nombre no se cambia porque ya se usó en cotizaciones o gastos.</span>{/if}
      </label>
      <label class="ancho">Qué vende <input bind:value={ficha.queVende} placeholder="Vidrios y ventanas de aluminio" /></label>
      <label>Contacto <input bind:value={ficha.contacto} placeholder="Nombre de la persona" /></label>
      <label>Teléfono <input bind:value={ficha.telefono} inputmode="tel" /></label>
      <label>Correo <input bind:value={ficha.correo} type="email" /></label>
      <label class="ancho">Notas <textarea bind:value={ficha.notas} rows="3"></textarea></label>
    </div>
    <div class="acciones">
      <button class="btn" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      <button class="btn-borde" type="button" onclick={() => (editando = null)}>Cancelar</button>
    </div>
  </form>
</Ventana>

<style>
  .herramientas {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 14px;
  }
  .herramientas input {
    flex: 1 1 240px;
    margin: 0;
  }
  .lista {
    list-style: none;
    padding: 0;
    margin: 12px 0 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 10px;
  }
  .fila {
    width: 100%;
    margin: 0;
    text-align: left;
    display: grid;
    gap: 3px;
    font-weight: 400;
    color: var(--texto);
    padding: 14px 16px;
  }
  .fila:hover {
    border-color: var(--dorado);
  }
  .fila strong {
    font-size: 1.05rem;
  }
  .fila span,
  .fila small {
    color: var(--suave);
  }
  .volver {
    margin-bottom: 8px;
  }
  .dos {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
    margin-top: 12px;
  }
  .dos .tarjeta {
    margin-top: 0;
  }
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 14px;
    margin: 8px 0;
  }
  dt {
    color: var(--suave);
    font-size: 0.88rem;
  }
  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .notas {
    white-space: pre-wrap;
  }
  .acciones a {
    text-decoration: none;
    display: inline-flex;
    align-items: center;
  }
  .pagado {
    margin: 6px 0 10px;
  }
  .movs {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 4px;
    font-size: 0.9rem;
  }
  .movs li {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    border-top: 1px dashed var(--linea);
    padding-top: 4px;
  }
  .usada a {
    font-weight: 700;
    color: var(--dorado-osc);
  }
  textarea {
    width: 100%;
  }
</style>
