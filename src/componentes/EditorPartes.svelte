<script lang="ts">
  import { tick } from 'svelte';
  import { datos } from '../lib/datos.svelte.ts';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { romano } from '../lib/cotizacion.ts';
  import { aNumero, colones } from '../lib/formato.ts';
  import type { DatosCotizacion } from '../lib/tipos.ts';
  import CampoNumero from './CampoNumero.svelte';

  let { d }: { d: DatosCotizacion } = $props();

  const porPartes = $derived(d.modoPrecio === 'Partes + materiales');
  const servicios = $derived(datos.c?.servicios ?? []);

  /** Etiqueta de cada Parte: "PARTE II" (solo las que tienen nombre se numeran). */
  const etiquetas = $derived.by(() => {
    let n = 0;
    return d.partes.map((p) => (p.nombre.trim() ? `PARTE ${romano(++n)}` : 'Sin nombre (no se numera)'));
  });

  let lista = $state<HTMLElement>();

  async function enfocar(parte: number, renglon: number) {
    await tick();
    lista?.querySelector<HTMLInputElement>(`[data-r="${parte}-${renglon}"]`)?.focus();
  }

  async function nuevaParte() {
    d.partes.push({ nombre: '', monto: null, renglones: [{ texto: '', clienteVe: true }] });
    await tick();
    lista?.querySelector<HTMLInputElement>(`[data-p="${d.partes.length - 1}"]`)?.focus();
  }

  function nuevoRenglon(i: number, despues?: number) {
    const r = d.partes[i].renglones;
    const pos = despues === undefined ? r.length : despues + 1;
    r.splice(pos, 0, { texto: '', clienteVe: true });
    enfocar(i, pos);
  }

  /** Enter en un renglón crea otro debajo (para escribir rápido, una cosa por renglón). */
  function teclaRenglon(ev: KeyboardEvent, i: number, j: number) {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      nuevoRenglon(i, j);
    } else if (ev.key === 'Backspace' && d.partes[i].renglones[j].texto === '' && d.partes[i].renglones.length > 1) {
      ev.preventDefault();
      d.partes[i].renglones.splice(j, 1);
      enfocar(i, Math.max(0, j - 1));
    }
  }

  function mover(i: number, paso: number) {
    const j = i + paso;
    if (j < 0 || j >= d.partes.length) return;
    [d.partes[i], d.partes[j]] = [d.partes[j], d.partes[i]];
  }

  async function quitarParte(i: number) {
    const p = d.partes[i];
    const tiene = p.nombre.trim() || p.monto !== null || p.renglones.some((r) => r.texto.trim());
    if (tiene && !(await dialogos.confirmar(`¿Quitar ${etiquetas[i].startsWith('PARTE') ? etiquetas[i] : 'esta Parte'}?`, p.nombre || '', { si: 'Quitar', peligro: true }))) return;
    d.partes.splice(i, 1);
  }

  // ---- Agregar un servicio del catálogo a una Parte ----
  let servicioEn = $state<number | null>(null);
  let servicioNombre = $state('');
  let servicioCantidad = $state('1');
  const servicioElegido = $derived(servicios.find((s) => s.servicio === servicioNombre));

  function abrirServicio(i: number) {
    servicioEn = i;
    servicioNombre = servicios[0]?.servicio ?? '';
    servicioCantidad = '1';
  }

  const UNIDAD: Record<string, string> = { 'Por hora': 'horas', 'Por m²': 'm²', 'Por metro lineal': 'm', 'Por día': 'días', 'Precio fijo': '' };

  function agregarServicio(i: number) {
    const s = servicioElegido;
    if (!s) return;
    const fijo = s.formaCobro === 'Precio fijo';
    const cant = fijo ? 1 : aNumero(servicioCantidad);
    if (cant === null || cant <= 0) return dialogos.avisar('Escribí una cantidad.', 'error');
    const texto = (s.descripcion.trim() || s.servicio) + (fijo ? '' : ` (${cant} ${UNIDAD[s.formaCobro]})`);
    const p = d.partes[i];
    // Usa el primer renglón vacío, si hay; si no, agrega uno.
    const vacio = p.renglones.findIndex((r) => !r.texto.trim());
    if (vacio >= 0) p.renglones[vacio].texto = texto;
    else p.renglones.push({ texto, clienteVe: true });
    if (s.precio !== null) p.monto = Math.round((p.monto ?? 0) + cant * s.precio);
    servicioEn = null;
    dialogos.avisar(s.precio !== null ? `Agregado: ${colones(cant * s.precio)} a la Parte` : 'Agregado (el servicio no tiene precio)');
  }
</script>

<div class="partes" bind:this={lista}>
  {#each d.partes as p, i}
    <div class="parte">
      <div class="parte-cabeza">
        <span class="etiqueta" class:sin-nombre={!p.nombre.trim()}>{etiquetas[i]}</span>
        <div class="acciones">
          <button class="btn-borde btn-chico" onclick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir Parte">↑</button>
          <button class="btn-borde btn-chico" onclick={() => mover(i, 1)} disabled={i === d.partes.length - 1} aria-label="Bajar Parte">↓</button>
          <button class="btn-peligro btn-chico" onclick={() => quitarParte(i)}>Quitar</button>
        </div>
      </div>

      <div class="parte-datos">
        <label>Nombre de la Parte <input bind:value={p.nombre} data-p={i} placeholder="ej. Estructura del techo" /></label>
        <label>
          Monto (₡)
          <CampoNumero bind:valor={p.monto} dinero etiqueta="Monto de la Parte" />
        </label>
      </div>
      {#if !porPartes && p.monto !== null}
        <p class="ayuda">El monto de cada Parte solo se usa en el modo "Partes + materiales".</p>
      {/if}

      <ul class="renglones">
        {#each p.renglones as r, j}
          <li class:oculto={!r.clienteVe}>
            <input
              bind:value={r.texto}
              data-r="{i}-{j}"
              onkeydown={(ev) => teclaRenglon(ev, i, j)}
              aria-label="Renglón {j + 1}"
              placeholder="Una cosa por renglón"
            />
            <label class="ve" title="¿Lo ve el cliente?">
              <input type="checkbox" bind:checked={r.clienteVe} />
              <span>{r.clienteVe ? 'Lo ve' : 'Oculto'}</span>
            </label>
            <button class="quitar" onclick={() => p.renglones.splice(j, 1)} aria-label="Quitar renglón {j + 1}">×</button>
          </li>
        {/each}
      </ul>

      <div class="acciones">
        <button class="btn-borde btn-chico" onclick={() => nuevoRenglon(i)}>+ renglón</button>
        {#if servicios.length}
          <button class="btn-borde btn-chico" onclick={() => abrirServicio(i)}>+ Agregar servicio</button>
        {/if}
      </div>

      {#if servicioEn === i}
        <div class="servicio">
          <label>
            Servicio
            <select bind:value={servicioNombre}>
              {#each servicios as s}<option value={s.servicio}>{s.servicio} — {s.formaCobro}{s.precio !== null ? ' ' + colones(s.precio) : ''}</option>{/each}
            </select>
          </label>
          {#if servicioElegido && servicioElegido.formaCobro !== 'Precio fijo'}
            <label>Cantidad ({UNIDAD[servicioElegido.formaCobro]}) <input bind:value={servicioCantidad} inputmode="decimal" /></label>
          {/if}
          <div class="acciones">
            <button class="btn btn-chico" onclick={() => agregarServicio(i)}>Agregar</button>
            <button class="btn-borde btn-chico" onclick={() => (servicioEn = null)}>Cancelar</button>
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <p class="vacio">Todavía no hay Partes.</p>
  {/each}
</div>

<button class="btn-dorado" onclick={nuevaParte}>+ Parte</button>
<p class="ayuda">Consejo: en un renglón, Enter crea el siguiente renglón.</p>

<style>
  .partes {
    display: grid;
    gap: 14px;
    margin-bottom: 14px;
  }
  .parte {
    border: 1px solid var(--linea);
    border-radius: 8px;
    padding: 12px;
    background: #fdfcf9;
  }
  .parte-cabeza {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .etiqueta {
    font-weight: 700;
    color: var(--dorado-osc);
    letter-spacing: 0.05em;
  }
  .etiqueta.sin-nombre {
    color: var(--suave);
    font-weight: 400;
    font-size: 0.85rem;
    letter-spacing: 0;
  }
  .parte-datos {
    display: grid;
    grid-template-columns: 1fr 170px;
    gap: 10px;
  }
  .renglones {
    list-style: none;
    padding: 0;
    margin: 10px 0;
    display: grid;
    gap: 6px;
  }
  .renglones li {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .renglones li > input {
    margin: 0;
    flex: 1;
  }
  .renglones li.oculto > input {
    color: var(--suave);
    background: #f3f0ea;
    text-decoration: line-through;
    text-decoration-color: #c7bfb1;
  }
  .ve {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.78rem;
    width: 72px;
    cursor: pointer;
    font-weight: 600;
  }
  .quitar {
    background: transparent;
    border: none;
    color: var(--suave);
    font-size: 1.3rem;
    padding: 0 8px;
    min-height: 38px;
  }
  .quitar:hover {
    color: var(--rojo);
  }
  .servicio {
    margin-top: 10px;
    padding: 10px;
    border: 1px dashed var(--dorado);
    border-radius: 8px;
    display: grid;
    gap: 8px;
  }
  @media (max-width: 560px) {
    .parte-datos {
      grid-template-columns: 1fr;
    }
  }
</style>
