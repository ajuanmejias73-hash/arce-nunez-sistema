<script lang="ts" module>
  export interface CuartoTexto {
    nombre: string;
    largo: string;
    ancho: string;
    estimado: boolean;
  }
  export interface AberturaTexto {
    tipo: 'Puerta' | 'Ventana';
    nombre: string;
    ancho: string;
    alto: string;
    cantidad: string;
    estimado: boolean;
  }
  export interface PlanoTexto {
    alto: string;
    cuartos: CuartoTexto[];
    aberturas: AberturaTexto[];
    respuesta: string;
  }
</script>

<script lang="ts">
  /**
   * Pestaña "Plano" de la Calculadora. Sin costo: la lectura del plano se hace en un chat
   * de IA gratis (con la instrucción que se copia aquí) y la respuesta se pega para llenar
   * los datos. También se puede llenar a mano.
   */
  import { onDestroy } from 'svelte';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { aNumero } from '../lib/formato.ts';
  import { num } from '../lib/calculadoras.ts';
  import { INSTRUCCION_CHAT, calcularPlano, leerRespuesta, type Plano } from '../lib/plano.ts';

  let {
    p,
    pasarAPisos,
    pasarAAreas,
    agregar,
  }: {
    p: PlanoTexto;
    pasarAPisos: (plano: Plano, anchoPuertas: number) => void;
    pasarAAreas: (plano: Plano, cuartos: { nombre: string; perimetro: number }[]) => void;
    agregar: (renglon: string) => void;
  } = $props();

  const n = (t: string) => aNumero(t) ?? 0;

  /** Lo escrito, pasado a números. */
  const plano = $derived<Plano>({
    altoParedes: n(p.alto),
    cuartos: p.cuartos.map((c) => ({ nombre: c.nombre.trim() || 'Espacio', largo: n(c.largo), ancho: n(c.ancho), estimado: c.estimado })),
    aberturas: p.aberturas.map((a) => ({ tipo: a.tipo, nombre: a.nombre.trim() || a.tipo, ancho: n(a.ancho), alto: n(a.alto), cantidad: Math.round(n(a.cantidad)), estimado: a.estimado })),
  });
  const calc = $derived(calcularPlano(plano));

  // ---- Imagen del plano (solo para verla aquí; no se guarda en ningún lado) ----
  let imagen = $state<string | null>(null);
  function verPlano(ev: Event) {
    const archivo = (ev.currentTarget as HTMLInputElement).files?.[0];
    if (!archivo) return;
    if (imagen) URL.revokeObjectURL(imagen);
    imagen = URL.createObjectURL(archivo);
  }
  onDestroy(() => imagen && URL.revokeObjectURL(imagen));

  async function copiarInstruccion() {
    try {
      await navigator.clipboard.writeText(INSTRUCCION_CHAT);
      dialogos.avisar('Instrucción copiada. Pegala en el chat junto con la foto del plano.');
    } catch {
      dialogos.avisar('No se pudo copiar solo: abrí "Ver la instrucción" y copiala a mano.', 'error');
    }
  }

  let ignoradas = $state<string[]>([]);

  async function leer() {
    const { plano: leido, ignoradas: malas } = leerRespuesta(p.respuesta);
    if (!leido.cuartos.length && !leido.aberturas.length) {
      dialogos.avisar('No encontré medidas en lo que pegaste. Revisá que el chat haya respondido con líneas "CUARTO: …".', 'error');
      return;
    }
    const hayDatos = p.cuartos.some((c) => c.largo || c.ancho) || p.aberturas.some((a) => a.ancho);
    if (hayDatos && !(await dialogos.confirmar('¿Reemplazar las medidas?', 'Lo que está escrito abajo se cambia por lo que respondió el chat.', { si: 'Reemplazar' }))) return;
    const t = (x: number) => String(Math.round(x * 100) / 100);
    if (leido.altoParedes) p.alto = t(leido.altoParedes);
    p.cuartos = leido.cuartos.map((c) => ({ nombre: c.nombre, largo: t(c.largo), ancho: t(c.ancho), estimado: !!c.estimado }));
    p.aberturas = leido.aberturas.map((a) => ({ tipo: a.tipo, nombre: a.nombre, ancho: t(a.ancho), alto: t(a.alto), cantidad: String(a.cantidad), estimado: !!a.estimado }));
    ignoradas = malas.filter((l) => /\d/.test(l));
    dialogos.avisar(`Listo: ${leido.cuartos.length} espacios y ${leido.aberturas.length} puertas/ventanas. Revisá las medidas.`);
  }

  function renglon() {
    return `Plano: ${num(calc.area)} m² de piso en ${calc.cuartos.length} ${calc.cuartos.length === 1 ? 'espacio' : 'espacios'}; ${num(calc.paredesNetas)} m² de paredes (sin puertas ni ventanas).`;
  }
</script>

<section class="tarjeta pasos">
  <h2>Leer un plano (sin costo)</h2>
  <ol>
    <li>
      <strong>Subí la imagen del plano</strong> para tenerla a la vista (no se guarda).
      <label class="btn-borde subir">Escoger imagen <input type="file" accept="image/*" class="oculto-visual" onchange={verPlano} /></label>
    </li>
    <li>
      <strong>Copiá la instrucción</strong> y pegala en un chat de IA gratis (ChatGPT, Gemini o Claude) junto con la foto del plano. Ahí mismo le podés hacer las preguntas que querás.
      <div class="acciones"><button class="btn-dorado" onclick={copiarInstruccion}>Copiar instrucción para el chat</button></div>
      <details><summary>Ver la instrucción</summary><pre>{INSTRUCCION_CHAT}</pre></details>
    </li>
    <li>
      <strong>Pegá aquí la respuesta del chat</strong> y tocá "Leer respuesta": se llenan solas las medidas de abajo.
      <textarea bind:value={p.respuesta} rows="5" placeholder="CUARTO: Cuarto principal | 3.50 | 4.00&#10;CUARTO: Baño | 2.25 | 2.20&#10;PUERTA: Puerta | 1.05 | 2.10 | 3" aria-label="Respuesta del chat"></textarea>
      <div class="acciones"><button class="btn" onclick={leer} disabled={!p.respuesta.trim()}>Leer respuesta</button></div>
      {#if ignoradas.length}
        <p class="error">No pude leer estas líneas (revisalas y escribilas a mano abajo):<br />{#each ignoradas as l}<code>{l}</code><br />{/each}</p>
      {/if}
    </li>
  </ol>
</section>

<div class="dos-columnas">
  {#if imagen}
    <section class="tarjeta imagen">
      <h2>Plano</h2>
      <a href={imagen} target="_blank" rel="noopener"><img src={imagen} alt="Plano subido" /></a>
      <p class="ayuda">Tocá la imagen para verla en grande.</p>
    </section>
  {/if}

  <section class="tarjeta">
    <h2>Medidas</h2>
    {#if calc.hayEstimados}<p class="aviso-estimado">⚠ Hay medidas <strong>estimadas</strong> por el chat (marcadas abajo): revisalas con el plano.</p>{/if}
    <label class="alto">Alto de las paredes (m) <input bind:value={p.alto} inputmode="decimal" /></label>

    <h3>Espacios</h3>
    <div class="filas">
      <div class="fila cabeza" aria-hidden="true"><span>Nombre</span><span>Largo (m)</span><span>Ancho (m)</span><span></span></div>
      {#each p.cuartos as c, i}
        <div class="fila" class:estimado={c.estimado}>
          <input bind:value={c.nombre} placeholder="Espacio {i + 1}" aria-label="Nombre del espacio {i + 1}" />
          <input bind:value={c.largo} inputmode="decimal" aria-label="Largo {i + 1}" oninput={() => (c.estimado = false)} />
          <input bind:value={c.ancho} inputmode="decimal" aria-label="Ancho {i + 1}" oninput={() => (c.estimado = false)} />
          <button class="quitar" onclick={() => p.cuartos.splice(i, 1)} aria-label="Quitar espacio {i + 1}">×</button>
        </div>
      {/each}
    </div>
    <button class="btn-borde btn-chico" onclick={() => p.cuartos.push({ nombre: '', largo: '', ancho: '', estimado: false })}>+ Espacio</button>

    <h3>Puertas y ventanas</h3>
    <div class="filas">
      <div class="fila aberturas cabeza" aria-hidden="true"><span>Tipo</span><span>Nombre</span><span>Ancho (m)</span><span>Alto (m)</span><span>Cant.</span><span></span></div>
      {#each p.aberturas as a, i}
        <div class="fila aberturas" class:estimado={a.estimado}>
          <select bind:value={a.tipo} aria-label="Tipo {i + 1}"><option>Puerta</option><option>Ventana</option></select>
          <input bind:value={a.nombre} placeholder={a.tipo} aria-label="Nombre {i + 1}" />
          <input bind:value={a.ancho} inputmode="decimal" aria-label="Ancho {i + 1}" oninput={() => (a.estimado = false)} />
          <input bind:value={a.alto} inputmode="decimal" aria-label="Alto {i + 1}" oninput={() => (a.estimado = false)} />
          <input bind:value={a.cantidad} inputmode="numeric" aria-label="Cantidad {i + 1}" />
          <button class="quitar" onclick={() => p.aberturas.splice(i, 1)} aria-label="Quitar {a.tipo} {i + 1}">×</button>
        </div>
      {/each}
    </div>
    <div class="acciones">
      <button class="btn-borde btn-chico" onclick={() => p.aberturas.push({ tipo: 'Puerta', nombre: '', ancho: '', alto: '2.10', cantidad: '1', estimado: false })}>+ Puerta</button>
      <button class="btn-borde btn-chico" onclick={() => p.aberturas.push({ tipo: 'Ventana', nombre: '', ancho: '', alto: '1.00', cantidad: '1', estimado: false })}>+ Ventana</button>
    </div>
  </section>
</div>

<section class="tarjeta resultado">
  <h2>Cálculos del plano</h2>
  {#if calc.cuartos.length}
    <table class="tabla">
      <thead><tr><th>Espacio</th><th class="num">Piso (m²)</th><th class="num">Perímetro (m)</th><th class="num">Paredes (m²)</th></tr></thead>
      <tbody>
        {#each calc.cuartos as c}
          <tr><td>{c.nombre}{c.estimado ? ' ⚠' : ''}</td><td class="num">{num(c.area)}</td><td class="num">{num(c.perimetro)}</td><td class="num">{num(c.paredes)}</td></tr>
        {/each}
        <tr class="total"><td>Total</td><td class="num">{num(calc.area)}</td><td class="num">{num(calc.perimetro)}</td><td class="num">{num(calc.paredesBrutas)}</td></tr>
      </tbody>
    </table>
    <div class="cifras">
      <span>Piso total: <strong>{num(calc.area)} m²</strong></span>
      <span>Puertas y ventanas: <strong>−{num(calc.huecos)} m²</strong></span>
      <span>Paredes netas: <strong>{num(calc.paredesNetas)} m²</strong></span>
    </div>
    <p class="ayuda">Las paredes se cuentan por dentro de cada espacio (sirve para pintura y repello). Una pared que divide dos espacios aparece dos veces, una por cada cara.</p>
    <div class="acciones">
      <button class="btn-dorado" onclick={() => pasarAPisos(plano, calc.anchoPuertas)}>Pasar a Pisos →</button>
      <button class="btn" onclick={() => pasarAAreas(plano, calc.cuartos)}>Pasar paredes a Áreas →</button>
      <button class="btn-borde" onclick={() => agregar(renglon())}>Agregar resumen a la cotización</button>
    </div>
  {:else}
    <p class="vacio">Escribí o pegá las medidas de al menos un espacio.</p>
  {/if}
</section>

<style>
  .pasos ol {
    padding-left: 20px;
    display: grid;
    gap: 14px;
    margin: 0;
  }
  .pasos li .acciones,
  .pasos textarea {
    margin-top: 8px;
  }
  .subir {
    display: inline-flex;
    margin-left: 6px;
    padding: 5px 12px;
    border: 1px solid var(--linea);
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    color: var(--texto);
    font-size: 0.9rem;
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
    font-size: 0.82rem;
  }
  code {
    font-size: 0.85rem;
  }
  .dos-columnas {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    gap: 16px;
    margin-top: 16px;
    align-items: start;
  }
  .dos-columnas > :only-child {
    grid-column: 1 / -1;
  }
  .dos-columnas .tarjeta + .tarjeta {
    margin-top: 0;
  }
  .imagen img {
    width: 100%;
    border: 1px solid var(--linea);
    border-radius: 6px;
  }
  .alto {
    max-width: 220px;
  }
  h3 {
    font-size: 0.95rem;
    margin: 14px 0 6px;
  }
  .filas {
    display: grid;
    gap: 6px;
    margin-bottom: 8px;
  }
  .fila {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 34px;
    gap: 6px;
    align-items: center;
  }
  .fila.aberturas {
    grid-template-columns: 1.1fr 1.6fr 1fr 1fr 0.7fr 34px;
  }
  .fila input,
  .fila select {
    margin: 0;
    min-width: 0;
  }
  .fila.estimado input {
    background: #fff6dc;
    border-color: #e5c86a;
  }
  .cabeza {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--suave);
  }
  .quitar {
    background: transparent;
    border: none;
    color: var(--suave);
    font-size: 1.3rem;
    padding: 0;
    min-height: 38px;
  }
  .aviso-estimado {
    background: #fff1c9;
    border: 1px solid #ecd58f;
    border-radius: 8px;
    padding: 8px 10px;
  }
  .resultado {
    margin-top: 16px !important;
  }
  .total td {
    font-weight: 700;
    border-top: 2px solid var(--carbon);
  }
  .cifras {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin: 12px 0 6px;
    padding: 10px;
    background: var(--fondo);
    border-radius: 8px;
  }
  @media (max-width: 900px) {
    .dos-columnas {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 560px) {
    .fila.aberturas {
      grid-template-columns: 1fr 1fr 1fr 34px;
    }
    .fila.aberturas > :nth-child(2) {
      grid-column: span 3;
    }
    .cabeza {
      display: none;
    }
  }
</style>
