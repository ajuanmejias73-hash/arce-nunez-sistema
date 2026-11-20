<script lang="ts">
  import { datos } from '../lib/datos.svelte.ts';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { sesion } from '../lib/sesion.svelte.ts';
  import { colones } from '../lib/formato.ts';
  import { categorias, deTipo, etiquetaMedida, tipos } from '../lib/catalogo.ts';
  import type { Calculo } from '../lib/cotizacion.ts';
  import type { DatosCotizacion } from '../lib/tipos.ts';
  import CampoNumero from './CampoNumero.svelte';
  import CampoCantidad from './CampoCantidad.svelte';

  let { d, calculo }: { d: DatosCotizacion; calculo: Calculo } = $props();

  const catalogo = $derived(datos.c?.materiales ?? []);
  const nombres = $derived(new Set(catalogo.flatMap((m) => [m.material, ...(m.antes ?? [])])));
  const unidades = $derived(datos.c?.ajustes.listas.unidades ?? []);

  function nuevo() {
    d.materiales.push({ material: '', cantidad: null, unidad: '', precioEspecial: null, clienteVe: true });
  }

  // Escoger del catálogo: Categoría → Tipo → Medida.
  let selCategoria = $state('');
  let selTipo = $state('');
  let selMaterial = $state('');
  const listaCategorias = $derived(categorias(catalogo));
  const listaTipos = $derived(selCategoria ? tipos(catalogo, selCategoria) : []);
  const listaMedidas = $derived(selCategoria && selTipo ? deTipo(catalogo, selCategoria, selTipo) : []);

  function escogerCategoria(valor: string) {
    selCategoria = valor;
    const ts = valor ? tipos(catalogo, valor) : [];
    escogerTipo(ts.length === 1 ? ts[0].nombre : '');
  }
  function escogerTipo(valor: string) {
    selTipo = valor;
    const ms = selCategoria && valor ? deTipo(catalogo, selCategoria, valor) : [];
    selMaterial = ms.length === 1 ? ms[0].material : '';
  }
  function agregarEscogido() {
    if (!selMaterial) return;
    const vacia = d.materiales.findIndex((f) => !f.material.trim());
    if (vacia >= 0) d.materiales[vacia].material = selMaterial;
    else d.materiales.push({ material: selMaterial, cantidad: null, unidad: '', precioEspecial: null, clienteVe: true });
    dialogos.avisar(`Agregado: ${selMaterial}`);
    selMaterial = listaMedidas.length === 1 ? selMaterial : '';
  }

  async function alCatalogo(i: number) {
    const f = d.materiales[i];
    const nombre = f.material.trim();
    if (!nombre || nombres.has(nombre)) return;
    const ok = await dialogos.confirmar(`¿Agregar «${nombre}» al catálogo?`, 'Así aparece en la lista la próxima vez.', { si: 'Agregar' });
    if (!ok) return;
    try {
      await datos.modificar(
        'materiales',
        (l) => {
          if (!l.some((m) => m.material.toLowerCase() === nombre.toLowerCase())) {
            l.push({ material: nombre, unidad: f.unidad || 'unid', precio: f.precioEspecial, categoria: '', notas: '', modificadoPor: sesion.quien, modificado: new Date().toISOString() });
          }
        },
        `agregó el material «${nombre}»`,
        sesion.quien,
      );
      dialogos.avisar('Agregado al catálogo');
    } catch (e) {
      dialogos.fallo(e);
    }
  }
</script>

<datalist id="lista-materiales">
  {#each catalogo as m}<option value={m.material}></option>{/each}
</datalist>
<datalist id="lista-unidades">
  {#each unidades as u}<option value={u}></option>{/each}
</datalist>

{#if d.materiales.length}
  <div class="filas">
    <div class="fila cabeza" aria-hidden="true">
      <span>Material</span><span>Cantidad</span><span>Unidad</span><span class="der">Precio catálogo</span><span class="der">Precio especial</span><span class="der">Total</span><span>¿Lo ve?</span><span></span>
    </div>
    {#each d.materiales as f, i}
      {@const c = calculo.filas[i]}
      <div class="fila" class:oculto={!f.clienteVe}>
        <div class="celda material">
          <span class="rotulo">Material</span>
          <input bind:value={f.material} list="lista-materiales" aria-label="Material {i + 1}" placeholder="Escogé o escribí" />
          {#if f.material.trim() && !nombres.has(f.material.trim())}
            <button class="enlace" onclick={() => alCatalogo(i)}>¿Agregarlo al catálogo?</button>
          {/if}
        </div>
        <div class="celda">
          <span class="rotulo">Cantidad</span>
          <CampoCantidad bind:valor={f.cantidad} etiqueta="Cantidad {i + 1}" />
        </div>
        <div class="celda">
          <span class="rotulo">Unidad</span>
          <input bind:value={f.unidad} list="lista-unidades" placeholder={c?.unidadFinal || ''} aria-label="Unidad {i + 1}" />
        </div>
        <div class="celda der"><span class="rotulo">Precio catálogo</span><span class="valor">{c?.precioCatalogo !== null && c?.precioCatalogo !== undefined ? colones(c.precioCatalogo) : '—'}</span></div>
        <div class="celda"><span class="rotulo">Precio especial</span><CampoNumero bind:valor={f.precioEspecial} dinero etiqueta="Precio especial {i + 1}" /></div>
        <div class="celda der"><span class="rotulo">Total</span><strong class="valor">{c?.total !== null && c?.total !== undefined ? colones(c.total) : '—'}</strong></div>
        <label class="celda ve">
          <span class="rotulo">¿Lo ve el cliente?</span>
          <span class="ve-caja"><input type="checkbox" bind:checked={f.clienteVe} /> {f.clienteVe ? 'Sí' : 'No'}</span>
        </label>
        <button class="quitar" onclick={() => d.materiales.splice(i, 1)} aria-label="Quitar material {i + 1}">×</button>
      </div>
    {/each}
  </div>
  <p class="total-mat">Total materiales: <strong>{colones(calculo.materiales)}</strong></p>
{:else}
  <p class="vacio">No hay materiales.</p>
{/if}

<div class="escoger">
  <strong class="escoger-titulo">Escoger del catálogo</strong>
  <label>
    <span class="etiqueta">Categoría</span>
    <select value={selCategoria} onchange={(ev) => escogerCategoria(ev.currentTarget.value)}>
      <option value="">— Escogé —</option>
      {#each listaCategorias as cat (cat.nombre)}<option value={cat.nombre}>{cat.nombre} ({cat.cantidad})</option>{/each}
    </select>
  </label>
  <label>
    <span class="etiqueta">Tipo</span>
    <select value={selTipo} onchange={(ev) => escogerTipo(ev.currentTarget.value)} disabled={!selCategoria}>
      <option value="">— Escogé —</option>
      {#each listaTipos as t (t.nombre)}<option value={t.nombre}>{t.nombre}{t.cantidad > 1 ? ` (${t.cantidad})` : ''}</option>{/each}
    </select>
  </label>
  <label>
    <span class="etiqueta">Medida y precio</span>
    <select bind:value={selMaterial} disabled={!selTipo}>
      <option value="">— Escogé —</option>
      {#each listaMedidas as m (m.material)}<option value={m.material}>{etiquetaMedida(m)} — {m.precio !== null ? colones(m.precio) : 'sin precio'} / {m.unidad}</option>{/each}
    </select>
  </label>
  <button class="btn" onclick={agregarEscogido} disabled={!selMaterial}>Agregar</button>
</div>

<button class="btn-dorado" onclick={nuevo}>+ Material escrito a mano</button>

<style>
  .filas {
    display: grid;
    gap: 6px;
    margin-bottom: 10px;
    container-type: inline-size;
  }
  .fila {
    display: grid;
    grid-template-columns: minmax(180px, 2.2fr) 0.8fr 0.8fr 0.9fr 1fr 0.9fr 64px 36px;
    gap: 6px;
    align-items: center;
  }
  .fila.cabeza {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--suave);
  }
  .fila.oculto input {
    background: #f3f0ea;
    color: var(--suave);
  }
  .celda {
    min-width: 0;
  }
  .celda :global(input) {
    margin: 0;
  }
  .der {
    text-align: right;
  }
  .rotulo {
    display: none;
  }
  .valor {
    font-size: 0.92rem;
  }
  .material {
    display: grid;
  }
  .enlace {
    background: none;
    border: none;
    padding: 2px 0 0;
    min-height: 0;
    color: var(--dorado-osc);
    font-size: 0.78rem;
    text-align: left;
    text-decoration: underline;
  }
  .ve-caja {
    display: flex;
    gap: 4px;
    align-items: center;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--texto);
  }
  .quitar {
    background: transparent;
    border: none;
    color: var(--suave);
    font-size: 1.3rem;
    padding: 0 6px;
    min-height: 38px;
  }
  .quitar:hover {
    color: var(--rojo);
  }
  .escoger {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.4fr) minmax(0, 1.6fr) auto;
    gap: 8px;
    align-items: end;
    background: #fbf7ee;
    border: 1px solid var(--linea);
    border-radius: 10px;
    padding: 10px 12px;
    margin-bottom: 10px;
  }
  .escoger-titulo {
    grid-column: 1 / -1;
    font-size: 0.9rem;
  }
  .escoger label {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .escoger select {
    margin: 0;
    width: 100%;
  }
  .etiqueta {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--suave);
  }
  @media (max-width: 760px) {
    .escoger {
      grid-template-columns: 1fr;
    }
  }
  .total-mat {
    text-align: right;
    margin: 6px 0 12px;
  }
  @container (max-width: 820px) {
    .fila.cabeza {
      display: none;
    }
    .fila {
      grid-template-columns: 1fr 1fr;
      border: 1px solid var(--linea);
      border-radius: 8px;
      padding: 10px;
      position: relative;
      background: #fdfcf9;
    }
    .material {
      grid-column: 1 / -1;
      padding-right: 34px;
    }
    .rotulo {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--suave);
    }
    .der {
      text-align: left;
    }
    .quitar {
      position: absolute;
      top: 4px;
      right: 4px;
    }
  }
</style>
