<script lang="ts">
  /** Clientes: lista, ficha de cada uno con sus cotizaciones y versiones, y lo que debe. */
  import { abrirEnEditor, modificar, puedeReemplazar } from '../lib/abrir.ts';
  import { claveNombre, listaClientes, numeroWhatsApp, telefonos, type ResumenCliente } from '../lib/contactos.ts';
  import { datosNuevos, siguienteNumero, ultimaVersion } from '../lib/cotizacion.ts';
  import { datos } from '../lib/datos.svelte.ts';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { colones, fecha, fechaHora } from '../lib/formato.ts';
  import { rutas } from '../lib/rutas.svelte.ts';
  import { sesion } from '../lib/sesion.svelte.ts';
  import type { Cliente } from '../lib/tipos.ts';
  import SelectorEstado from '../componentes/SelectorEstado.svelte';
  import Ventana from '../componentes/Ventana.svelte';

  const c = $derived(datos.c!);
  const lista = $derived(listaClientes(c.clientes, c.cotizaciones, c.movimientos));
  /** El cliente abierto (#/clientes/Nombre), o null en la lista. */
  const nombreAbierto = $derived(rutas.actual.startsWith('clientes/') ? decodeURIComponent(rutas.actual.slice('clientes/'.length)) : null);
  const abierto = $derived(nombreAbierto === null ? null : (lista.find((x) => claveNombre(x.nombre) === claveNombre(nombreAbierto)) ?? null));

  let buscar = $state('');
  const filtrados = $derived.by(() => {
    const q = buscar.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((x) => [x.nombre, x.telefono, x.ubicacion, x.correo, x.cedula].some((v) => v.toLowerCase().includes(q)));
  });
  const totalDebe = $derived(lista.reduce((s, x) => s + x.debe, 0));

  const abrir = (nombre: string) => rutas.ir('clientes/' + encodeURIComponent(nombre));

  // ---- Ficha (agregar / editar) ----
  const VACIA: Cliente = { nombre: '', telefono: '', ubicacion: '', correo: '', cedula: '', notas: '' };
  let ficha = $state<Cliente>({ ...VACIA });
  /** null = cerrada; '' = cliente nuevo; nombre = editando ese. */
  let editando = $state<string | null>(null);
  let guardando = $state(false);
  const conCotizaciones = $derived(editando ? (lista.find((x) => claveNombre(x.nombre) === claveNombre(editando!))?.cotizaciones.length ?? 0) > 0 : false);

  function nuevo() {
    ficha = { ...VACIA };
    editando = '';
  }

  function editar(r: ResumenCliente) {
    ficha = { nombre: r.nombre, telefono: r.telefono, ubicacion: r.ubicacion, correo: r.correo, cedula: r.cedula, notas: r.notas };
    editando = r.nombre;
  }

  async function guardar(ev: SubmitEvent) {
    ev.preventDefault();
    const nombre = ficha.nombre.trim();
    if (!nombre) return dialogos.avisar('Falta el nombre.', 'error');
    const original = editando ?? '';
    const esNuevo = original === '';
    if (claveNombre(nombre) !== claveNombre(original) && lista.some((x) => claveNombre(x.nombre) === claveNombre(nombre))) {
      return dialogos.avisar(`Ya existe un cliente «${nombre}».`, 'error');
    }
    guardando = true;
    try {
      const registro: Cliente = {
        nombre,
        telefono: ficha.telefono.trim(),
        ubicacion: ficha.ubicacion.trim(),
        correo: ficha.correo.trim(),
        cedula: ficha.cedula.trim(),
        notas: ficha.notas.trim(),
        modificadoPor: sesion.quien,
        modificado: new Date().toISOString(),
      };
      await datos.modificar(
        'clientes',
        (l) => {
          const i = esNuevo ? -1 : l.findIndex((x) => claveNombre(x.nombre) === claveNombre(original));
          if (i >= 0) l[i] = registro;
          else l.push(registro);
        },
        esNuevo ? `agregó al cliente «${nombre}»` : `editó al cliente «${nombre}»`,
        sesion.quien,
      );
      editando = null;
      dialogos.avisar('Guardado');
      if (esNuevo) {
        abrir(nombre);
        if (await dialogos.confirmar(`¿Hacerle una cotización a ${nombre} ahora?`, 'Se abre con su nombre, teléfono y ubicación ya puestos.', { si: 'Sí, cotizar', no: 'Ahora no' })) {
          await cotizar(registro.nombre, registro.telefono, registro.ubicacion);
        }
      } else if (claveNombre(nombre) !== claveNombre(original)) abrir(nombre);
    } catch (e) {
      dialogos.fallo(e);
    } finally {
      guardando = false;
    }
  }

  async function borrarFicha(r: ResumenCliente) {
    const texto = r.cotizaciones.length ? 'Sus cotizaciones y pagos no se borran: solo los datos de la ficha (correo, cédula, notas).' : 'No tiene cotizaciones.';
    if (!(await dialogos.confirmar(`¿Borrar la ficha de «${r.nombre}»?`, texto, { si: 'Borrar', peligro: true }))) return;
    try {
      await datos.modificar('clientes', (l) => l.filter((x) => claveNombre(x.nombre) !== claveNombre(r.nombre)), `borró la ficha del cliente «${r.nombre}»`, sesion.quien);
      dialogos.avisar('Borrada');
      if (!r.cotizaciones.length) rutas.ir('clientes');
    } catch (e) {
      dialogos.fallo(e);
    }
  }

  async function cotizar(cliente: string, telefono: string, ubicacion: string) {
    if (!(await puedeReemplazar())) return;
    abrirEnEditor(datosNuevos(c.ajustes, siguienteNumero(c.cotizaciones, c.ajustes.porDefecto.prefijo), { cliente, telefono, ubicacion }), null);
  }
</script>

{#if nombreAbierto === null}
  <h1>Clientes</h1>
  <p class="ayuda">Todos los clientes: los que tienen ficha y los que salen en las cotizaciones.</p>

  <div class="herramientas">
    <input type="search" bind:value={buscar} placeholder="Buscar por nombre, teléfono, lugar, cédula…" aria-label="Buscar cliente" />
    <button class="btn-dorado" onclick={nuevo}>+ Agregar cliente</button>
  </div>
  <p class="ayuda">{lista.length} clientes{totalDebe > 0 ? ` · entre todos deben ${colones(totalDebe)}` : ''}</p>

  <ul class="lista">
    {#each filtrados as x (x.nombre)}
      <li>
        <button class="tarjeta fila" onclick={() => abrir(x.nombre)}>
          <strong>{x.nombre}</strong>
          <span>{[x.telefono, x.ubicacion].filter(Boolean).join(' · ') || 'Sin teléfono ni ubicación'}</span>
          <small>
            {x.cotizaciones.length ? `${x.cotizaciones.length} ${x.cotizaciones.length === 1 ? 'cotización' : 'cotizaciones'} · última ${fecha(x.ultima)}` : 'Sin cotizaciones todavía'}
          </small>
          {#if x.debe > 0}<span class="debe">Debe {colones(x.debe)}</span>{/if}
        </button>
      </li>
    {:else}
      <li class="vacio">{buscar ? 'Ningún cliente coincide.' : 'Todavía no hay clientes. Tocá "+ Agregar cliente".'}</li>
    {/each}
  </ul>
{:else if !abierto}
  <h1>Cliente no encontrado</h1>
  <p>No hay ningún cliente «{nombreAbierto}».</p>
  <button class="btn-borde" onclick={() => rutas.ir('clientes')}>← Volver a Clientes</button>
{:else}
  {@const x = abierto}
  <button class="volver btn-borde btn-chico" onclick={() => rutas.ir('clientes')}>← Clientes</button>
  <h1>{x.nombre}</h1>

  <div class="dos">
    <section class="tarjeta">
      <div class="tarjeta-titulo">
        <h2>Datos</h2>
        <div class="acciones">
          <button class="btn-borde btn-chico" onclick={() => editar(x)}>Editar</button>
          {#if x.ficha}<button class="btn-peligro btn-chico" onclick={() => borrarFicha(x)}>Borrar ficha</button>{/if}
        </div>
      </div>
      <dl class="datos">
        <dt>Teléfono</dt><dd>{x.telefono || '—'}</dd>
        <dt>Ubicación</dt><dd>{x.ubicacion || '—'}</dd>
        <dt>Correo</dt><dd>{x.correo || '—'}</dd>
        <dt>Cédula</dt><dd>{x.cedula || '—'}</dd>
        {#if x.notas}<dt>Notas</dt><dd class="notas">{x.notas}</dd>{/if}
      </dl>
      {#if !x.ficha}<p class="ayuda">Estos datos salen de su última cotización. Tocá "Editar" para guardarle correo, cédula y notas.</p>{/if}
      <div class="acciones contacto">
        {#each telefonos(x.telefono).slice(0, 2) as t}
          <a class="btn-borde btn-chico" href="tel:{t.replace(/[\s-]/g, '')}">📞 Llamar {t}</a>
          <a class="btn-borde btn-chico" href="https://wa.me/{numeroWhatsApp(t)}" target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>
        {/each}
      </div>
      <button class="btn-dorado nueva" onclick={() => cotizar(x.nombre, x.telefono, x.ubicacion)}>+ Nueva cotización para {x.nombre}</button>
    </section>

    <section class="tarjeta">
      <h2>Plata</h2>
      <dl class="plata">
        <dt>Cotizaciones</dt><dd>{x.cotizaciones.length}</dd>
        <dt>Aceptado</dt><dd>{colones(x.aceptado)}</dd>
        <dt>Pagado</dt><dd>{colones(x.pagado)}</dd>
        <dt>Debe</dt><dd class:rojo={x.debe > 0}><strong>{colones(x.debe)}</strong></dd>
      </dl>
      <p class="ayuda">"Aceptado" y "Debe" cuentan solo las cotizaciones aceptadas, en proceso, terminadas o pagadas.</p>
    </section>
  </div>

  <section class="tarjeta">
    <h2>Cotizaciones y versiones</h2>
    {#each x.cotizaciones as q (q.numero)}
      {@const u = ultimaVersion(q)}
      <article class="cot">
        <div class="cot-cabeza">
          <div>
            <strong>{q.numero}</strong> · {fecha(u.datos.fecha)}
            <div class="ayuda">{u.datos.trabajoSolicitado || u.datos.tipoTrabajo || 'Sin descripción'}</div>
          </div>
          <SelectorEstado c={q} />
          <strong class="total">{colones(u.total)}</strong>
        </div>
        <ul class="versiones">
          {#each [...q.versiones].reverse() as v (v.version)}
            <li>
              <a href="#/ver/{encodeURIComponent(q.numero)}/v{v.version}">v{v.version}</a>
              <span>{fechaHora(v.guardado) || fecha(v.guardado)} · {v.guardadoPor || '—'}</span>
              <span class="total">{colones(v.total)}</span>
              {#if v.queCambio}<small>{v.queCambio}</small>{/if}
            </li>
          {/each}
        </ul>
        <div class="acciones">
          <button class="btn-borde btn-chico" onclick={() => rutas.ir('ver/' + encodeURIComponent(q.numero))}>Ver</button>
          <button class="btn-borde btn-chico" onclick={() => modificar(q)}>Modificar (v{q.versionActual + 1})</button>
        </div>
      </article>
    {:else}
      <p class="vacio">Todavía no tiene cotizaciones.</p>
    {/each}
  </section>
{/if}

<Ventana abierta={editando !== null} titulo={editando ? `Editar a ${editando}` : 'Agregar cliente'} cerrar={() => (editando = null)}>
  <form onsubmit={guardar}>
    <div class="campos">
      <label class="ancho">
        Nombre
        <input bind:value={ficha.nombre} disabled={conCotizaciones} required />
        {#if conCotizaciones}<span class="ayuda">El nombre no se cambia porque ya tiene cotizaciones con ese nombre.</span>{/if}
      </label>
      <label>Teléfono <input bind:value={ficha.telefono} inputmode="tel" placeholder="8888-8888" /></label>
      <label>Ubicación <input bind:value={ficha.ubicacion} placeholder="Grecia, Alajuela" /></label>
      <label>Correo <input bind:value={ficha.correo} type="email" /></label>
      <label>Cédula <input bind:value={ficha.cedula} /></label>
      <label class="ancho">Notas (solo las ven ustedes) <textarea bind:value={ficha.notas} rows="3"></textarea></label>
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
  .fila .debe {
    color: var(--rojo);
    font-weight: 700;
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
  .plata dd {
    text-align: right;
  }
  .rojo {
    color: var(--rojo);
  }
  .contacto {
    margin-top: 10px;
  }
  .contacto a {
    text-decoration: none;
    display: inline-flex;
    align-items: center;
  }
  .nueva {
    margin-top: 12px;
    width: 100%;
  }
  .cot {
    border: 1px solid var(--linea);
    border-radius: 10px;
    padding: 12px 14px;
    margin-top: 10px;
  }
  .cot-cabeza {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 10px;
    align-items: center;
  }
  .total {
    text-align: right;
    white-space: nowrap;
  }
  .versiones {
    list-style: none;
    padding: 0;
    margin: 10px 0;
    display: grid;
    gap: 4px;
    font-size: 0.9rem;
  }
  .versiones li {
    display: grid;
    grid-template-columns: 44px 1fr auto;
    gap: 2px 10px;
    padding: 4px 0;
    border-top: 1px dashed var(--linea);
  }
  .versiones a {
    font-weight: 700;
    color: var(--dorado-osc);
  }
  .versiones small {
    grid-column: 2 / -1;
    color: var(--suave);
  }
  textarea {
    width: 100%;
  }
  @media (max-width: 600px) {
    .cot-cabeza {
      grid-template-columns: 1fr auto;
    }
    .cot-cabeza .total {
      grid-column: 1 / -1;
      text-align: left;
    }
  }
</style>
