<script lang="ts">
  /**
   * 🤖 Cotización automática: copiar la instrucción para Claude, contestar sus preguntas
   * allá, y pegar aquí el código que devuelve para llenar la cotización.
   */
  import { instruccionCotizacion, leerCodigo } from '../lib/autocotizar.ts';
  import { datos } from '../lib/datos.svelte.ts';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { editor } from '../lib/editor.svelte.ts';
  import Ventana from './Ventana.svelte';

  let { abierta = $bindable() }: { abierta: boolean } = $props();

  let codigo = $state('');
  let avisos = $state<string[]>([]);
  let copiada = $state(false);

  const instruccion = $derived.by(() => {
    if (!datos.c || !editor.d) return '';
    const d = editor.d;
    return instruccionCotizacion({
      ajustes: datos.c.ajustes,
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
  .listo ul {
    padding-left: 20px;
  }
  .listo li {
    margin: 4px 0;
  }
</style>
