<script lang="ts" module>
  /** Valores de ejemplo con que arranca (y vuelve con "Limpiar") cada calculadora. */
  function ejemplos() {
    const vacia = () => ({ descripcion: '', largo: '', alto: '', cantidad: '1' });
    return {
      areas: {
        superficies: [{ descripcion: 'Pared del frente', largo: '4', alto: '2.5', cantidad: '1' }, { descripcion: 'Paredes laterales', largo: '3', alto: '2.5', cantidad: '2' }, vacia(), vacia(), vacia(), vacia()],
        aberturas: [{ descripcion: 'Puerta', largo: '0.9', alto: '2.1', cantidad: '1' }, { descripcion: 'Ventana', largo: '1.2', alto: '1', cantidad: '1' }, vacia(), vacia()],
      },
      pintura: { m2: '50', manos: '2', sellador: false, desperdicio: '10' },
      durock: { largo: '6', alto: '3', caras: '2', aberturas: '0', separacion: '0.41', esquineros: '0', repello: true, desperdicio: '10' },
      ceramica: { m2: '20', desperdicio: '10', m2PorCaja: '1.5', nombre: 'Cerámica antideslizante' },
      concreto: { tipo: '', largo: '3', ancho: '3', espesor: '10', cantidad: '1', desperdicio: '5' },
      techo: { largo: '4', ancho: '6', pendiente: '15', largoLamina: '3.66', anchoUtil: '0.80', lamina: 'Lámina de policarbonato', canoa: true },
      estructura: {
        filas: [
          { material: 'Tubo 2x4"', medida: '2.5', cortes: '4', largoPieza: '6' },
          { material: 'Tubo galvanizado 2x1" (1,20)', medida: '1.2', cortes: '10', largoPieza: '6' },
          { material: '', medida: '', cortes: '', largoPieza: '6' },
          { material: '', medida: '', cortes: '', largoPieza: '6' },
          { material: '', medida: '', cortes: '', largoPieza: '6' },
          { material: '', medida: '', cortes: '', largoPieza: '6' },
        ],
        desperdicio: '5',
      },
      mano: { servicio: '', forma: 'Por hora' as FormaManoObra, cantidad: '40', precio: '3500', personas: '2', imprevistos: '0' },
      conversion: { valor: '1' },
    };
  }
  type Calc = keyof ReturnType<typeof ejemplos>;
  // Se mantiene mientras se navega entre pantallas.
  const estado = $state(ejemplos());
  /** Lo que la persona cambió en "¿Agregar?" de cada resultado. */
  const marcas = $state<Record<string, Record<string, boolean>>>({});
  let pestanaGuardada: Calc | 'rendimientos' = 'areas';
</script>

<script lang="ts">
  import * as C from '../lib/calculadoras.ts';
  import type { FormaManoObra, Resultado } from '../lib/calculadoras.ts';
  import { datos } from '../lib/datos.svelte.ts';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { editor } from '../lib/editor.svelte.ts';
  import { aNumero, colones } from '../lib/formato.ts';
  import { FORMAS_COBRO } from '../lib/tipos.ts';
  import DialogoAgregar from '../componentes/DialogoAgregar.svelte';
  import Rendimientos from '../componentes/Rendimientos.svelte';

  const PESTANAS: { id: Calc | 'rendimientos'; nombre: string }[] = [
    { id: 'areas', nombre: 'Áreas' },
    { id: 'pintura', nombre: 'Pintura' },
    { id: 'durock', nombre: 'Durock / gypsum' },
    { id: 'ceramica', nombre: 'Cerámica' },
    { id: 'concreto', nombre: 'Concreto y mortero' },
    { id: 'techo', nombre: 'Techos' },
    { id: 'estructura', nombre: 'Estructura metálica' },
    { id: 'mano', nombre: 'Mano de obra' },
    { id: 'conversion', nombre: 'Conversiones' },
    { id: 'rendimientos', nombre: '⚙ Rendimientos' },
  ];

  let pestana = $state(pestanaGuardada);
  $effect(() => {
    pestanaGuardada = pestana;
  });

  const n = (t: string) => aNumero(t) ?? 0;
  const pct = (t: string) => n(t) / 100;
  const r = $derived(datos.c!.ajustes.rendimientos);
  const mezclas = $derived(datos.c!.ajustes.mezclas);
  const catalogo = $derived(datos.c!.materiales);
  const servicios = $derived(datos.c!.servicios);

  // ---- Resultados (se recalculan al escribir) ----
  const area = $derived(
    C.areas(
      estado.areas.superficies.map((s) => ({ descripcion: s.descripcion, largo: n(s.largo), alto: n(s.alto), cantidad: n(s.cantidad) })),
      estado.areas.aberturas.map((s) => ({ descripcion: s.descripcion, largo: n(s.largo), alto: n(s.alto), cantidad: n(s.cantidad) })),
    ),
  );
  const mezcla = $derived(mezclas.find((m) => m.tipo === estado.concreto.tipo) ?? mezclas[0]);
  $effect(() => {
    if (mezclas[0] && !mezclas.some((m) => m.tipo === estado.concreto.tipo)) estado.concreto.tipo = mezclas[0].tipo;
  });

  const resultados = $derived<Record<Calc, Resultado | null>>({
    areas: area.resultado,
    pintura: C.pintura({ m2: n(estado.pintura.m2), manos: n(estado.pintura.manos), sellador: estado.pintura.sellador, desperdicio: pct(estado.pintura.desperdicio) }, r),
    durock: C.durock(
      {
        largo: n(estado.durock.largo),
        alto: n(estado.durock.alto),
        caras: n(estado.durock.caras),
        aberturas: n(estado.durock.aberturas),
        separacion: n(estado.durock.separacion),
        esquineros: n(estado.durock.esquineros),
        repello: estado.durock.repello,
        desperdicio: pct(estado.durock.desperdicio),
      },
      r,
    ),
    ceramica: C.ceramica({ m2: n(estado.ceramica.m2), desperdicio: pct(estado.ceramica.desperdicio), m2PorCaja: n(estado.ceramica.m2PorCaja), nombre: estado.ceramica.nombre }, r),
    concreto: mezcla
      ? C.concreto({ mezcla, largo: n(estado.concreto.largo), ancho: n(estado.concreto.ancho), espesorCm: n(estado.concreto.espesor), cantidad: n(estado.concreto.cantidad), desperdicio: pct(estado.concreto.desperdicio) })
      : null,
    techo: C.techo(
      {
        largo: n(estado.techo.largo),
        ancho: n(estado.techo.ancho),
        pendiente: pct(estado.techo.pendiente),
        largoLamina: n(estado.techo.largoLamina),
        anchoUtil: n(estado.techo.anchoUtil),
        lamina: estado.techo.lamina,
        canoa: estado.techo.canoa,
      },
      r,
    ),
    estructura: C.estructura(
      estado.estructura.filas.map((f) => ({ material: f.material, medida: n(f.medida), cortes: n(f.cortes), largoPieza: n(f.largoPieza) })),
      pct(estado.estructura.desperdicio),
    ),
    mano: C.manoDeObra({ forma: estado.mano.forma, cantidad: n(estado.mano.cantidad), precio: n(estado.mano.precio), personas: n(estado.mano.personas), imprevistos: pct(estado.mano.imprevistos) }),
    conversion: null,
  });

  /** El resultado de la pestaña, con las marcas de "¿Agregar?" que cambió la persona. */
  const actual = $derived.by(() => {
    if (pestana === 'rendimientos') return null;
    const res = resultados[pestana];
    if (!res) return null;
    const m = marcas[pestana] ?? {};
    return { ...res, materiales: res.materiales.map((x) => ({ ...x, agregar: m[x.material] ?? x.agregar })) };
  });

  const precioDe = (nombre: string) => catalogo.find((m) => m.material === nombre)?.precio ?? null;

  function marcar(nombre: string, valor: boolean) {
    if (pestana === 'rendimientos') return;
    (marcas[pestana] ??= {})[nombre] = valor;
  }

  let paraAgregar = $state<Resultado | null>(null);

  function agregar() {
    if (actual) paraAgregar = $state.snapshot(actual) as Resultado;
  }

  async function limpiar() {
    if (pestana === 'rendimientos') return;
    const nombre = PESTANAS.find((p) => p.id === pestana)!.nombre;
    if (!(await dialogos.confirmar(`¿Limpiar "${nombre}"?`, 'Vuelve a los valores de ejemplo. Los rendimientos no cambian.', { si: 'Limpiar' }))) return;
    const e = ejemplos();
    (estado as Record<string, unknown>)[pestana] = e[pestana];
    delete marcas[pestana];
  }

  function elegirServicio() {
    const s = servicios.find((x) => x.servicio === estado.mano.servicio);
    if (!s) return;
    estado.mano.forma = s.formaCobro;
    if (s.precio !== null) estado.mano.precio = String(s.precio);
  }

  const UNIDAD_MANO: Record<FormaManoObra, string> = { 'Por hora': 'Horas', 'Por m²': 'm²', 'Por metro lineal': 'Metros', 'Por día': 'Días', 'Precio fijo': '' };
</script>

<h1>Calculadora de obra</h1>
<p class="destino">
  {#if editor.d}
    Lo que agregués va a <strong>{editor.d.numero}{editor.d.cliente.trim() ? ' · ' + editor.d.cliente.trim() : ''}</strong>.
  {:else}
    No hay ninguna cotización abierta: al agregar, se puede crear una nueva.
  {/if}
</p>

<div class="pestanas" role="tablist" aria-label="Calculadoras">
  {#each PESTANAS as p}
    <button role="tab" aria-selected={pestana === p.id} class:activa={pestana === p.id} onclick={() => (pestana = p.id)}>{p.nombre}</button>
  {/each}
</div>

{#snippet campo(etiqueta: string, obj: Record<string, unknown>, clave: string, ayuda = '')}
  <label>
    {etiqueta}
    <input value={obj[clave] as string} oninput={(e) => (obj[clave] = e.currentTarget.value)} inputmode="decimal" />
    {#if ayuda}<span class="ayuda">{ayuda}</span>{/if}
  </label>
{/snippet}

{#snippet siNo(etiqueta: string, obj: Record<string, unknown>, clave: string)}
  <label class="casilla"><input type="checkbox" checked={obj[clave] as boolean} onchange={(e) => (obj[clave] = e.currentTarget.checked)} /> {etiqueta}</label>
{/snippet}

{#snippet usarArea(obj: Record<string, unknown>, clave: string)}
  {#if area.neta > 0 && n(obj[clave] as string) !== area.neta}
    <button class="enlace" onclick={() => (obj[clave] = String(area.neta))}>Usar el área neta de "Áreas": {C.num(area.neta)} m²</button>
  {/if}
{/snippet}

{#if pestana === 'rendimientos'}
  <Rendimientos />
{:else}
  <section class="tarjeta calc">
    <div class="datos">
      <h2>Datos</h2>

      {#if pestana === 'areas'}
        <h3>Superficies</h3>
        <div class="filas">
          <div class="fila cabeza" aria-hidden="true"><span>Descripción</span><span>Largo (m)</span><span>Alto (m)</span><span>Cantidad</span></div>
          {#each estado.areas.superficies as s, i}
            <div class="fila">
              <input bind:value={s.descripcion} aria-label="Superficie {i + 1}" placeholder="Superficie {i + 1}" />
              <input bind:value={s.largo} inputmode="decimal" aria-label="Largo {i + 1}" />
              <input bind:value={s.alto} inputmode="decimal" aria-label="Alto {i + 1}" />
              <input bind:value={s.cantidad} inputmode="decimal" aria-label="Cantidad {i + 1}" />
            </div>
          {/each}
        </div>
        <h3>Aberturas que se restan (puertas, ventanas)</h3>
        <div class="filas">
          {#each estado.areas.aberturas as s, i}
            <div class="fila">
              <input bind:value={s.descripcion} aria-label="Abertura {i + 1}" placeholder="Abertura {i + 1}" />
              <input bind:value={s.largo} inputmode="decimal" aria-label="Ancho abertura {i + 1}" />
              <input bind:value={s.alto} inputmode="decimal" aria-label="Alto abertura {i + 1}" />
              <input bind:value={s.cantidad} inputmode="decimal" aria-label="Cantidad abertura {i + 1}" />
            </div>
          {/each}
        </div>
        <div class="totales">
          <span>Bruta: <strong>{C.num(area.bruta)} m²</strong></span>
          <span>Aberturas: <strong>−{C.num(area.aberturas)} m²</strong></span>
          <span>Neta: <strong>{C.num(area.neta)} m²</strong></span>
        </div>
        <p class="ayuda">Pintura, Cerámica y Mano de obra pueden tomar esta área neta con un toque.</p>
      {:else if pestana === 'pintura'}
        <div class="campos">
          {@render campo('Área (m²)', estado.pintura, 'm2')}
          {@render campo('Manos', estado.pintura, 'manos')}
          {@render campo('Desperdicio (%)', estado.pintura, 'desperdicio')}
          {@render siNo('¿Lleva sellador?', estado.pintura, 'sellador')}
        </div>
        {@render usarArea(estado.pintura, 'm2')}
      {:else if pestana === 'durock'}
        <div class="campos">
          {@render campo('Largo (m)', estado.durock, 'largo')}
          {@render campo('Alto (m)', estado.durock, 'alto')}
          {@render campo('Caras', estado.durock, 'caras')}
          {@render campo('Aberturas (m²)', estado.durock, 'aberturas')}
          {@render campo('Separación de studs (m)', estado.durock, 'separacion')}
          {@render campo('Esquineros', estado.durock, 'esquineros')}
          {@render campo('Desperdicio (%)', estado.durock, 'desperdicio')}
          {@render siNo('¿Repello en saco?', estado.durock, 'repello')}
        </div>
      {:else if pestana === 'ceramica'}
        <div class="campos">
          {@render campo('Área (m²)', estado.ceramica, 'm2')}
          {@render campo('Desperdicio (%)', estado.ceramica, 'desperdicio', '10% normal, 15% en diagonal')}
          {@render campo('m² por caja', estado.ceramica, 'm2PorCaja')}
          <label>Nombre de la cerámica <input bind:value={estado.ceramica.nombre} list="calc-materiales" /></label>
        </div>
        {@render usarArea(estado.ceramica, 'm2')}
      {:else if pestana === 'concreto'}
        <div class="campos">
          <label>
            Tipo de mezcla
            <select bind:value={estado.concreto.tipo}>
              {#each mezclas as m}<option value={m.tipo}>{m.tipo}</option>{/each}
            </select>
          </label>
          {@render campo('Largo (m)', estado.concreto, 'largo')}
          {@render campo('Ancho (m)', estado.concreto, 'ancho')}
          {@render campo('Espesor (cm)', estado.concreto, 'espesor')}
          {@render campo('Cantidad', estado.concreto, 'cantidad')}
          {@render campo('Desperdicio (%)', estado.concreto, 'desperdicio')}
        </div>
      {:else if pestana === 'techo'}
        <div class="campos">
          {@render campo('Largo de caída, horizontal (m)', estado.techo, 'largo')}
          {@render campo('Ancho / frente (m)', estado.techo, 'ancho')}
          {@render campo('Pendiente (%)', estado.techo, 'pendiente')}
          {@render campo('Largo de lámina (m)', estado.techo, 'largoLamina')}
          {@render campo('Ancho útil de lámina (m)', estado.techo, 'anchoUtil')}
          <label>Tipo de lámina <input bind:value={estado.techo.lamina} list="calc-materiales" /></label>
          {@render siNo('¿Lleva canoa?', estado.techo, 'canoa')}
        </div>
      {:else if pestana === 'estructura'}
        <div class="filas">
          <div class="fila cabeza estructura" aria-hidden="true"><span>Material</span><span>Medida de cada corte (m)</span><span>N.º de cortes</span><span>Largo de pieza (m)</span></div>
          {#each estado.estructura.filas as f, i}
            <div class="fila estructura">
              <input bind:value={f.material} list="calc-materiales" aria-label="Material {i + 1}" placeholder="Material {i + 1}" />
              <input bind:value={f.medida} inputmode="decimal" aria-label="Medida {i + 1}" />
              <input bind:value={f.cortes} inputmode="decimal" aria-label="Cortes {i + 1}" />
              <input bind:value={f.largoPieza} inputmode="decimal" aria-label="Largo de pieza {i + 1}" />
            </div>
          {/each}
        </div>
        <div class="campos">{@render campo('Desperdicio (%)', estado.estructura, 'desperdicio')}</div>
      {:else if pestana === 'mano'}
        <div class="campos">
          {#if servicios.length}
            <label class="ancho">
              Servicio del catálogo (opcional)
              <select bind:value={estado.mano.servicio} onchange={elegirServicio}>
                <option value="">— escribir a mano —</option>
                {#each servicios as s}<option value={s.servicio}>{s.servicio} ({s.formaCobro}{s.precio !== null ? ' ' + colones(s.precio) : ''})</option>{/each}
              </select>
            </label>
          {/if}
          <label>
            Forma de cobro
            <select bind:value={estado.mano.forma}>
              {#each FORMAS_COBRO as f}<option>{f}</option>{/each}
            </select>
          </label>
          {#if estado.mano.forma !== 'Precio fijo'}{@render campo(UNIDAD_MANO[estado.mano.forma], estado.mano, 'cantidad')}{/if}
          {@render campo(estado.mano.forma === 'Precio fijo' ? 'Precio (₡)' : `Precio por ${UNIDAD_MANO[estado.mano.forma].toLowerCase().replace(/s$/, '')} (₡)`, estado.mano, 'precio')}
          {#if estado.mano.forma === 'Por hora' || estado.mano.forma === 'Por día'}{@render campo('Personas', estado.mano, 'personas')}{/if}
          {@render campo('Imprevistos (%)', estado.mano, 'imprevistos')}
        </div>
        {#if estado.mano.forma === 'Por m²'}{@render usarArea(estado.mano, 'cantidad')}{/if}
      {:else if pestana === 'conversion'}
        <div class="campos">{@render campo('Valor', estado.conversion, 'valor')}</div>
        <ul class="conversiones">
          {#each C.conversiones(n(estado.conversion.valor), r.metrosPorVara) as x}
            <li><span>{C.num(n(estado.conversion.valor))} {x.de}</span> = <strong>{x.valor.toLocaleString('en-US', { maximumFractionDigits: 4 })} {x.a}</strong></li>
          {/each}
        </ul>
      {/if}
    </div>

    {#if actual}
      <div class="resultado">
        <h2>Resultado</h2>
        <p class="renglon">«{actual.renglon}»</p>
        {#each actual.extras ?? [] as x}<p class="extra">{x.etiqueta}: <strong>{x.valor}</strong></p>{/each}
        {#if actual.monto !== undefined}<p class="monto">Monto: <strong>{colones(actual.monto)}</strong></p>{/if}

        {#if actual.materiales.length}
          <table class="tabla resultados">
            <thead><tr><th>Material</th><th class="num">Cantidad</th><th>¿Agregar?</th></tr></thead>
            <tbody>
              {#each actual.materiales as m}
                {@const precio = precioDe(m.material)}
                <tr class:apagado={!m.agregar || m.cantidad <= 0}>
                  <td>
                    {m.material}
                    {#if precio !== null && m.cantidad > 0}<small class="precio">{colones(precio)} c/u · {colones(precio * m.cantidad)}</small>{/if}
                  </td>
                  <td class="num">{C.num(m.cantidad)} {m.unidad}</td>
                  <td><input type="checkbox" checked={m.agregar} disabled={m.cantidad <= 0} onchange={(e) => marcar(m.material, e.currentTarget.checked)} aria-label="Agregar {m.material}" /></td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}

        <div class="acciones pie">
          <button class="btn-dorado" onclick={agregar}>Agregar a la cotización</button>
          <button class="btn-borde" onclick={limpiar}>Limpiar calculadora</button>
        </div>
      </div>
    {:else if pestana === 'conversion'}
      <div class="resultado">
        <p class="ayuda">Las conversiones son solo de consulta: no se agregan a la cotización.</p>
        <button class="btn-borde" onclick={limpiar}>Limpiar calculadora</button>
      </div>
    {/if}
  </section>
{/if}

<datalist id="calc-materiales">
  {#each catalogo as m}<option value={m.material}></option>{/each}
</datalist>

<DialogoAgregar bind:resultado={paraAgregar} />

<style>
  .destino {
    color: var(--suave);
    margin: 0 0 12px;
  }
  .pestanas {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 6px;
    margin-bottom: 12px;
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
  .calc {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: 24px;
    container-type: inline-size;
  }
  h3 {
    font-size: 0.95rem;
    margin: 14px 0 6px;
  }
  .filas {
    display: grid;
    gap: 6px;
  }
  .fila {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: 6px;
  }
  .fila input {
    margin: 0;
    min-width: 0;
  }
  .fila.cabeza {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--suave);
  }
  .totales {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin-top: 12px;
    padding: 10px;
    background: var(--fondo);
    border-radius: 8px;
  }
  .casilla {
    display: flex;
    gap: 8px;
    align-items: center;
    color: var(--texto);
    align-self: end;
    min-height: 42px;
    cursor: pointer;
  }
  .enlace {
    background: none;
    border: none;
    padding: 6px 0;
    min-height: 0;
    color: var(--dorado-osc);
    text-decoration: underline;
    font-weight: 600;
    font-size: 0.9rem;
  }
  .resultado {
    background: var(--fondo);
    border-radius: 10px;
    padding: 16px;
    align-self: start;
  }
  .renglon {
    font-style: italic;
    font-size: 1.05rem;
    margin: 0 0 8px;
  }
  .extra,
  .monto {
    margin: 4px 0;
    color: var(--suave);
  }
  .monto strong {
    color: var(--texto);
    font-size: 1.2rem;
  }
  .resultados {
    margin-top: 10px;
    background: var(--blanco);
  }
  .resultados td {
    padding: 6px 8px;
  }
  .precio {
    display: block;
    color: var(--suave);
  }
  tr.apagado td {
    color: #a29a8c;
  }
  .pie {
    margin-top: 14px;
  }
  .conversiones {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 6px;
    margin-top: 12px;
  }
  .conversiones li {
    background: var(--fondo);
    padding: 8px 10px;
    border-radius: 6px;
  }
  @media (max-width: 1000px) {
    .calc {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 560px) {
    .fila {
      grid-template-columns: 1fr 1fr 1fr;
    }
    .fila > input:first-child {
      grid-column: 1 / -1;
    }
    .fila.cabeza {
      display: none;
    }
  }
</style>
