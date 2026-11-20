<script lang="ts">
  /**
   * 🤖 Cotización automática: copiar la instrucción para Claude, contestar sus preguntas
   * allá, y pegar aquí el código que devuelve para llenar la cotización.
   */
  import { instruccionCotizacion, leerCodigo } from '../lib/autocotizar.ts';
  import { categorias } from '../lib/catalogo.ts';
  import { datos } from '../lib/datos.svelte.ts';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { editor } from '../lib/editor.svelte.ts';
  import Ventana from './Ventana.svelte';

  let { abierta = $bindable() }: { abierta: boolean } = $props();

  let codigo = $state('');
  let avisos = $state<string[]>([]);
  let copiada = $state(false);

  // Qué categorías de materiales van en la instrucción (se recuerdan en este aparato).
  const GUARDADAS = 'arce.automatica.categorias';
  function leerGuardadas(): string[] | null {
    try {
      const v = JSON.parse(localStorage.getItem(GUARDADAS) ?? 'null');
      return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : null;
    } catch {
      return null;
    }
  }
  const todasCategorias = $derived(categorias(datos.c?.materiales ?? []));
  /** Con pocos materiales van todos; con el catálogo grande se escogen las categorías. */
  const escoger = $derived((datos.c?.materiales.length ?? 0) > 300);
  let escogidas = $state<string[]>(leerGuardadas() ?? []);
  function cambiarCategoria(nombre: string, si: boolean) {
    escogidas = si ? [...new Set([...escogidas, nombre])] : escogidas.filter((x) => x !== nombre);
    copiada = false;
    try {
      localStorage.setItem(GUARDADAS, JSON.stringify(escogidas));
    } catch {
      /* sin memoria en este aparato: no pasa nada */
    }
  }
  const cantidadEscogida = $derived(todasCategorias.filter((c) => escogidas.includes(c.nombre)).reduce((s, c) => s + c.cantidad, 0));

  const instruccion = $derived.by(() => {
    if (!datos.c || !editor.d) return '';
    const d = editor.d;
    return instruccionCotizacion({
      ajustes: datos.c.ajustes,
      ...(escoger ? { categorias: escogidas } : {}),
      materiales: datos.c.materiales,
      servicios: datos.c.servicios,
      cotizaciones: datos.c.cotizaciones,
      actual: { cliente: d.cliente, telefono: d.telefono, ubicacion: d.ubicacion, tipoTrabajo: d.tipoTrabajo, trabajoSolicitado: d.trabajoSolicitado },
    });
  });

  async function copiar() {
    try {
      await navigator.clipboard.writeText(instruccion);
      copiada = true;
      dialogos.avisar('Instrucción copiada. Pegala en Claude.');
    } catch {
      dialogos.avisar('No se pudo copiar solo: abrí "Ver la instrucción" y copiala a mano.', 'error');
    }
  }

  function abrirClaude() {
    window.open('https://claude.ai/new', '_blank', 'noopener,noreferrer');
  }

  async function llenar() {
    if (!editor.d || !datos.c) return;
    let resultado;
    try {
      resultado = leerCodigo(codigo, $state.snapshot(editor.d), datos.c.materiales, datos.c.ajustes.listas.categoriasGasto);
    } catch (e) {
      dialogos.avisar(e instanceof Error ? e.message : String(e), 'error');
      return;
    }
    const d = editor.d;
    const tieneAlgo = d.partes.some((p) => p.nombre.trim() || p.renglones.some((r) => r.texto.trim())) || d.materiales.length > 0;
    if (tieneAlgo) {
      const ok = await dialogos.confirmar(
        '¿Reemplazar lo que tiene la cotización?',
        'Las partes, materiales, costos extras y notas se cambian por lo que armó Claude. El número, la fecha y las fotos se quedan.',
        { si: 'Reemplazar' },
      );
      if (!ok) return;
    }
    Object.assign(d, resultado.datos);
    avisos = resultado.avisos;
    codigo = '';
    if (!avisos.length) {
      abierta = false;
      dialogos.avisar('¡Listo! La cotización se llenó. Revisala y guardala.');
    }
  }
</script>

<Ventana {abierta} titulo="🤖 Cotización automática" cerrar={() => ((abierta = false), (avisos = []))}>
  {#if avisos.length}
    <div class="listo">
      <p><strong>¡Listo! La cotización se llenó.</strong> Revisá esto antes de guardar:</p>
      <ul>{#each avisos as a}<li>{a}</li>{/each}</ul>
      <button class="btn" onclick={() => ((abierta = false), (avisos = []))}>Ir a revisarla</button>
    </div>
  {:else}
    <ol class="pasos">
      {#if escoger}
        <li>
          <strong>Escogé qué materiales lleva el trabajo.</strong> Solo esas categorías van con sus precios (si van todas, la instrucción queda demasiado larga).
          <div class="categorias">
            {#each todasCategorias as cat (cat.nombre)}
              <label class="categoria">
                <input type="checkbox" checked={escogidas.includes(cat.nombre)} onchange={(ev) => cambiarCategoria(cat.nombre, ev.currentTarget.checked)} />
                <span>{cat.nombre} <small>({cat.cantidad})</small></span>
              </label>
            {/each}
          </div>
          <p class="ayuda" class:alerta={!cantidadEscogida || cantidadEscogida > 2500}>
            {#if !cantidadEscogida}
              No escogiste ninguna: Claude te va a preguntar el precio de cada material.
            {:else}
              Van {cantidadEscogida.toLocaleString('es-CR')} materiales.{cantidadEscogida > 2500 ? ' Son muchos: Claude podría no recibir la instrucción completa. Quitá las que no hagan falta.' : ''}
            {/if}
            {#if escogidas.length}<button class="enlace" onclick={() => todasCategorias.forEach((c) => cambiarCategoria(c.nombre, false))}>Quitar todas</button>{/if}
          </p>
        </li>
      {/if}
      <li>
        <strong>Copiá la instrucción.</strong> Ya trae sus precios, servicios, condiciones y ejemplos de sus cotizaciones.
        <div class="acciones">
          <button class="btn-dorado" onclick={copiar}>{copiada ? '✓ Copiada — copiar otra vez' : 'Copiar instrucción'}</button>
          <button class="btn-borde" onclick={abrirClaude}>Abrir Claude ↗</button>
        </div>
        <details><summary>Ver la instrucción</summary><pre>{instruccion}</pre></details>
      </li>
      <li>
        <strong>En Claude:</strong> pegala, adjuntá el plano o las fotos (si tenés) y mandala. Claude te va a hacer preguntas con opciones; contestalas
        (podés escoger "Otro" y escribir).
      </li>
      <li>
        <strong>Al final Claude te da un código.</strong> Copialo completo y pegalo aquí:
        <textarea bind:value={codigo} rows="6" placeholder={'```json\n{ "arce_nunez_cotizacion": 1, "cliente": "…", "partes": [ … ] }\n```'} aria-label="Código de Claude"></textarea>
        <div class="acciones">
          <button class="btn" onclick={llenar} disabled={!codigo.trim()}>Llenar la cotización</button>
        </div>
      </li>
    </ol>
    <p class="ayuda">Todo lo que llene Claude se puede cambiar después. Claude usa sus precios, pero siempre revisá los montos.</p>
  {/if}
</Ventana>

<style>
  .pasos {
    padding-left: 20px;
    display: grid;
    gap: 14px;
    margin: 0 0 10px;
  }
  .pasos .acciones,
  .pasos textarea {
    margin-top: 8px;
  }
  details {
    margin-top: 6px;
  }
  summary {
    cursor: pointer;
    color: var(--dorado-osc);
    font-weight: 600;
    font-size: 0.9rem;
  }
  pre {
    white-space: pre-wrap;
    background: var(--fondo);
    padding: 10px;
    border-radius: 8px;
    font-size: 0.78rem;
    max-height: 260px;
    overflow: auto;
  }
  .categorias {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 2px 10px;
    margin-top: 8px;
    max-height: 260px;
    overflow: auto;
    border: 1px solid var(--linea);
    border-radius: 8px;
    padding: 6px 8px;
  }
  .categoria {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 0.88rem;
    font-weight: 500;
    min-height: 32px;
  }
  .categoria input {
    margin: 0;
    width: auto;
  }
  .categoria small {
    color: var(--suave);
  }
  .alerta {
    color: var(--dorado-osc);
    font-weight: 600;
  }
  .enlace {
    background: none;
    border: none;
    padding: 0 0 0 8px;
    min-height: 0;
    color: var(--dorado-osc);
    text-decoration: underline;
    font-size: 0.85rem;
  }
  .listo ul {
    padding-left: 20px;
  }
  .listo li {
    margin: 4px 0;
  }
</style>
