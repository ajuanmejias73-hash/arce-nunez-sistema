<script lang="ts" module>
  import type { Losa, Techo, Tubo } from '../lib/plano.ts';

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
  export interface ParedTexto {
    nombre: string;
    largo: string;
    alto: string;
    caras: string;
    estimado: boolean;
  }
  export interface PlanoTexto {
    alto: string;
    cuartos: CuartoTexto[];
    aberturas: AberturaTexto[];
    paredes: ParedTexto[];
    techos: Techo[];
    losas: Losa[];
    tubos: Tubo[];
    notas: string[];
    respuesta: string;
  }

  /** Lo que la Calculadora hace con cada cosa del plano. */
  export interface AccionesPlano {
    pisos: (plano: import('../lib/plano.ts').Plano, anchoPuertas: number) => void;
    areas: (plano: import('../lib/plano.ts').Plano, cuartos: { nombre: string; perimetro: number }[]) => void;
    paredes: (plano: import('../lib/plano.ts').Plano) => void;
    techo: (t: Techo) => void;
    losa: (l: Losa) => void;
    estructura: (tubos: Tubo[]) => void;
    agregar: (renglon: string) => void;
  }
</script>

<script lang="ts">
  /**
   * Pestaña "Plano" de la Calculadora. Sin costo: la lectura del plano se hace en un chat
   * de IA gratis con una instrucción general (sirve para cualquier trabajo) y la respuesta
   * se pega aquí. Cada cosa encontrada se pasa con un toque a su calculadora.
   */
  import { onDestroy } from 'svelte';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { aNumero } from '../lib/formato.ts';
  import { num } from '../lib/calculadoras.ts';
  import { INSTRUCCION_CHAT, calcularPlano, leerRespuesta, type Plano } from '../lib/plano.ts';

  let { p, acciones }: { p: PlanoTexto; acciones: AccionesPlano } = $props();

  const n = (t: string) => aNumero(t) ?? 0;

  /** Lo escrito, pasado a números. */
  const plano = $derived<Plano>({
    altoParedes: n(p.alto),
    cuartos: p.cuartos.map((c) => ({ nombre: c.nombre.trim() || 'Espacio', largo: n(c.largo), ancho: n(c.ancho), estimado: c.estimado })),
    aberturas: p.aberturas.map((a) => ({ tipo: a.tipo, nombre: a.nombre.trim() || a.tipo, ancho: n(a.ancho), alto: n(a.alto), cantidad: Math.round(n(a.cantidad)), estimado: a.estimado })),
    paredes: p.paredes.map((w) => ({ nombre: w.nombre.trim() || 'Pared', largo: n(w.largo), alto: n(w.alto), caras: n(w.caras) === 1 ? 1 : 2, estimado: w.estimado })),
    techos: p.techos,
    losas: p.losas,
    tubos: p.tubos,
    notas: p.notas,
  });
  const calc = $derived(calcularPlano(plano));
  const hayAlgo = $derived(calc.cuartos.length + calc.paredes.length + calc.techos.length + calc.losas.length + calc.tubos.length > 0);

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
      dialogos.avisar('Instrucción copiada. Pegala en el chat y adjuntá el plano.');
    } catch {
      dialogos.avisar('No se pudo copiar solo: abrí "Ver la instrucción" y copiala a mano.', 'error');
    }
  }

  let ignoradas = $state<string[]>([]);

  async function leer() {
    const { plano: leido, ignoradas: malas } = leerRespuesta(p.respuesta);
    const cuantos = leido.cuartos.length + leido.aberturas.length + leido.paredes.length + leido.techos.length + leido.losas.length + leido.tubos.length;
    if (!cuantos) {
      dialogos.avisar('No encontré medidas en lo que pegaste. Revisá que el chat haya respondido con líneas como "ESPACIO: …", "TECHO: …" o "TUBO: …".', 'error');
      return;
    }
    if (hayAlgo && !(await dialogos.confirmar('¿Reemplazar las medidas?', 'Lo que está escrito abajo se cambia por lo que respondió el chat.', { si: 'Reemplazar' }))) return;
    const t = (x: number) => String(Math.round(x * 100) / 100);
    if (leido.altoParedes) p.alto = t(leido.altoParedes);
    p.cuartos = leido.cuartos.map((c) => ({ nombre: c.nombre, largo: t(c.largo), ancho: t(c.ancho), estimado: !!c.estimado }));
    p.aberturas = leido.aberturas.map((a) => ({ tipo: a.tipo, nombre: a.nombre, ancho: t(a.ancho), alto: t(a.alto), cantidad: String(a.cantidad), estimado: !!a.estimado }));
    p.paredes = leido.paredes.map((w) => ({ nombre: w.nombre, largo: t(w.largo), alto: t(w.alto), caras: String(w.caras), estimado: !!w.estimado }));
    p.techos = leido.techos;
    p.losas = leido.losas;
    p.tubos = leido.tubos;
    p.notas = leido.notas;
    ignoradas = malas.filter((l) => /\d/.test(l));
    const cuenta = (k: number, uno: string, varios: string) => (k ? `${k} ${k === 1 ? uno : varios}` : '');
    const partes = [
      cuenta(leido.cuartos.length, 'espacio', 'espacios'),
      cuenta(leido.paredes.length, 'pared', 'paredes'),
      cuenta(leido.aberturas.length, 'puerta o ventana', 'puertas y ventanas'),
      cuenta(leido.techos.length, 'techo', 'techos'),
      cuenta(leido.losas.length, 'losa', 'losas'),
      cuenta(leido.tubos.length, 'medida de tubo', 'medidas de tubo'),
    ].filter(Boolean);
    dialogos.avisar(`Listo: ${partes.join(', ')}. Revisá las medidas.`);
  }

  function renglon() {
    const partes = [
      calc.area > 0 && `${num(calc.area)} m² de piso`,
      calc.paredesNuevasM2 > 0 && `${num(calc.paredesNuevasM2)} m² de paredes nuevas`,
      calc.techoM2 > 0 && `${num(calc.techoM2)} m² de techo`,
      calc.losaM3 > 0 && `${num(calc.losaM3)} m³ de concreto`,
      calc.tuboMetros > 0 && `${num(calc.tuboMetros)} m lineales de tubo`,
    ].filter(Boolean);
    return `Según plano: ${partes.join(', ')}.`;
  }

  const est = (e?: boolean) => (e ? ' ⚠' : '');
</script>

<section class="tarjeta pasos">
  <h2>Leer un plano (sin costo)</h2>
  <p class="ayuda">Sirve para cualquier trabajo: casas, cuartos, paredes, pisos, techos, chorreas, portones, jaulas, estructuras…</p>
  <ol>
    <li>
      <strong>Copiá la instrucción</strong> (es la misma siempre) y pegala en un chat de IA gratis: ChatGPT, Gemini o Claude.
      <div class="acciones"><button class="btn-dorado" onclick={copiarInstruccion}>Copiar instrucción para el chat</button></div>
      <details><summary>Ver la instrucción</summary><pre>{INSTRUCCION_CHAT}</pre></details>
    </li>
    <li><strong>Adjuntá el plano</strong> en ese mismo chat y mandalo. Si querés, ahí mismo le hacés preguntas.</li>
    <li>
      <strong>Copiá lo que te respondió y pegalo aquí</strong>, y tocá "Leer respuesta".
      <textarea bind:value={p.respuesta} rows="6" placeholder="ESPACIO: Cuarto principal | 3.50 | 4.00&#10;TECHO: Cochera | 4.00 | 6.00 | 15&#10;TUBO: Tubo 2x2 | 2.00 | 6" aria-label="Respuesta del chat"></textarea>
      <div class="acciones">
        <button class="btn" onclick={leer} disabled={!p.respuesta.trim()}>Leer respuesta</button>
        <label class="btn-borde subir">Ver el plano aquí <input type="file" accept="image/*" class="oculto-visual" onchange={verPlano} /></label>
      </div>
      {#if ignoradas.length}
        <p class="error">No pude leer estas líneas (revisalas y escribilas a mano):<br />{#each ignoradas as l}<code>{l}</code><br />{/each}</p>
      {/if}
    </li>
  </ol>
</section>

{#if imagen}
  <section class="tarjeta imagen">
    <a href={imagen} target="_blank" rel="noopener"><img src={imagen} alt="Plano subido" /></a>
    <p class="ayuda">Tocá la imagen para verla en grande. No se guarda en ningún lado.</p>
  </section>
{/if}

{#if calc.hayEstimados}<p class="aviso-estimado">⚠ Hay medidas <strong>estimadas</strong> por el chat (marcadas con ⚠): revisalas con el plano.</p>{/if}
{#if p.notas.length}
  <section class="tarjeta notas">
    <h2>Notas del chat</h2>
    <ul>{#each p.notas as nota}<li>{nota}</li>{/each}</ul>
  </section>
{/if}

<!-- ESPACIOS, PUERTAS Y VENTANAS -->
<section class="tarjeta bloque">
  <div class="tarjeta-titulo">
    <h2>Espacios (pisos), puertas y ventanas</h2>
    <label class="alto">Alto de paredes (m) <input bind:value={p.alto} inputmode="decimal" /></label>
  </div>
  <div class="filas">
    <div class="fila cabeza" aria-hidden="true"><span>Espacio</span><span>Largo (m)</span><span>Ancho (m)</span><span></span></div>
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

  <div class="filas separado">
    <div class="fila aberturas cabeza" aria-hidden="true"><span>Tipo</span><span>Nombre</span><span>Ancho</span><span>Alto</span><span>Cant.</span><span></span></div>
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

  {#if calc.cuartos.length}
    <div class="cifras">
      <span>Piso: <strong>{num(calc.area)} m²</strong></span>
      <span>Perímetro: <strong>{num(calc.perimetro)} m</strong></span>
      <span>Paredes por dentro: <strong>{num(calc.paredesNetas)} m²</strong> <small>(sin puertas ni ventanas)</small></span>
    </div>
    <div class="acciones">
      <button class="btn-dorado" onclick={() => acciones.pisos(plano, calc.anchoPuertas)}>Pasar a Pisos →</button>
      <button class="btn" onclick={() => acciones.areas(plano, calc.cuartos)}>Paredes por dentro a Áreas (pintura) →</button>
    </div>
  {/if}
</section>

<!-- PAREDES NUEVAS -->
<section class="tarjeta bloque">
  <h2>Paredes nuevas (Durock, gypsum, repello)</h2>
  <div class="filas">
    <div class="fila paredes cabeza" aria-hidden="true"><span>Pared</span><span>Largo (m)</span><span>Alto (m)</span><span>Caras</span><span></span></div>
    {#each p.paredes as w, i}
      <div class="fila paredes" class:estimado={w.estimado}>
        <input bind:value={w.nombre} placeholder="Pared {i + 1}" aria-label="Nombre de la pared {i + 1}" />
        <input bind:value={w.largo} inputmode="decimal" aria-label="Largo de la pared {i + 1}" oninput={() => (w.estimado = false)} />
        <input bind:value={w.alto} inputmode="decimal" aria-label="Alto de la pared {i + 1}" oninput={() => (w.estimado = false)} />
        <select bind:value={w.caras} aria-label="Caras de la pared {i + 1}"><option value="1">1</option><option value="2">2</option></select>
        <button class="quitar" onclick={() => p.paredes.splice(i, 1)} aria-label="Quitar pared {i + 1}">×</button>
      </div>
    {/each}
  </div>
  <button class="btn-borde btn-chico" onclick={() => p.paredes.push({ nombre: '', largo: '', alto: p.alto || '2.50', caras: '2', estimado: false })}>+ Pared</button>
  {#if calc.paredes.length}
    <div class="cifras"><span>A forrar o repellar: <strong>{num(calc.paredesNuevasM2)} m²</strong> <small>(contando las caras)</small></span></div>
    <div class="acciones"><button class="btn-dorado" onclick={() => acciones.paredes(plano)}>Pasar a Paredes (Durock / gypsum) →</button></div>
  {/if}
</section>

<!-- TECHOS, LOSAS, TUBOS (solo si el chat los encontró) -->
{#if p.techos.length}
  <section class="tarjeta bloque">
    <h2>Techos</h2>
    <ul class="lista">
      {#each calc.techos as t, i}
        <li>
          <span><strong>{t.nombre}</strong>{est(t.estimado)} · caída {num(t.largo)} m × frente {num(t.ancho)} m · {num(t.pendiente)}% → <strong>{num(t.area)} m²</strong></span>
          <span class="acciones">
            <button class="btn-dorado btn-chico" onclick={() => acciones.techo(t)}>Pasar a Techos →</button>
            <button class="quitar" onclick={() => p.techos.splice(i, 1)} aria-label="Quitar techo {t.nombre}">×</button>
          </span>
        </li>
      {/each}
    </ul>
  </section>
{/if}

{#if p.losas.length}
  <section class="tarjeta bloque">
    <h2>Chorreas, losas y contrapisos</h2>
    <ul class="lista">
      {#each calc.losas as l, i}
        <li>
          <span><strong>{l.nombre}</strong>{est(l.estimado)} · {num(l.largo)} × {num(l.ancho)} m · {num(l.espesorCm)} cm → <strong>{num(l.m3)} m³</strong></span>
          <span class="acciones">
            <button class="btn-dorado btn-chico" onclick={() => acciones.losa(l)}>Pasar a Concreto →</button>
            <button class="quitar" onclick={() => p.losas.splice(i, 1)} aria-label="Quitar losa {l.nombre}">×</button>
          </span>
        </li>
      {/each}
    </ul>
  </section>
{/if}

{#if p.tubos.length}
  <section class="tarjeta bloque">
    <h2>Estructura metálica</h2>
    <ul class="lista">
      {#each p.tubos as t, i}
        <li>
          <span><strong>{t.material}</strong>{est(t.estimado)} · {t.cortes} cortes de {num(t.medida)} m = {num(Math.round(t.medida * t.cortes * 100) / 100)} m</span>
          <button class="quitar" onclick={() => p.tubos.splice(i, 1)} aria-label="Quitar {t.material}">×</button>
        </li>
      {/each}
    </ul>
    <div class="cifras"><span>Total: <strong>{num(calc.tuboMetros)} m lineales</strong></span></div>
    <div class="acciones"><button class="btn-dorado" onclick={() => acciones.estructura(calc.tubos)}>Pasar a Estructura metálica →</button></div>
  </section>
{/if}

{#if hayAlgo}
  <div class="acciones final">
    <button class="btn-borde" onclick={() => acciones.agregar(renglon())}>Agregar resumen del plano a la cotización</button>
  </div>
{/if}

<style>
  .pasos ol {
    padding-left: 20px;
    display: grid;
    gap: 14px;
    margin: 8px 0 0;
  }
  .pasos li .acciones,
  .pasos textarea {
    margin-top: 8px;
  }
  .subir {
    display: inline-flex;
    align-items: center;
    padding: 8px 14px;
    border: 1px solid var(--linea);
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    color: var(--texto);
    font-size: 0.95rem;
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
  .imagen,
  .notas,
  .bloque {
    margin-top: 16px !important;
  }
  .imagen img {
    max-width: 100%;
    max-height: 520px;
    display: block;
    margin: 0 auto;
    border: 1px solid var(--linea);
    border-radius: 6px;
  }
  .notas ul {
    margin: 0;
    padding-left: 20px;
  }
  .aviso-estimado {
    background: #fff1c9;
    border: 1px solid #ecd58f;
    border-radius: 8px;
    padding: 8px 10px;
    margin: 16px 0 0;
  }
  .alto {
    max-width: 180px;
  }
  .filas {
    display: grid;
    gap: 6px;
    margin-bottom: 8px;
  }
  .filas.separado {
    margin-top: 16px;
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
  .fila.paredes {
    grid-template-columns: 2fr 1fr 1fr 0.7fr 34px;
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
    padding: 0 4px;
    min-height: 34px;
  }
  .quitar:hover {
    color: var(--rojo);
  }
  .cifras {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin: 12px 0 8px;
    padding: 10px;
    background: var(--fondo);
    border-radius: 8px;
  }
  .cifras small {
    color: var(--suave);
  }
  .lista {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .lista li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    padding: 8px 0;
    border-bottom: 1px solid var(--linea);
  }
  .lista .acciones {
    flex-wrap: nowrap;
  }
  .final {
    margin-top: 16px;
  }
  @media (max-width: 560px) {
    .fila.aberturas,
    .fila.paredes {
      grid-template-columns: 1fr 1fr 1fr 34px;
    }
    .fila.aberturas > :nth-child(2),
    .fila.paredes > :first-child {
      grid-column: 1 / -1;
    }
    .cabeza {
      display: none;
    }
  }
</style>
