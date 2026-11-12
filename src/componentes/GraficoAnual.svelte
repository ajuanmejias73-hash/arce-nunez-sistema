<script lang="ts">
  /** Barras de ingresos contra gastos por mes (con detalle al pasar el dedo o el mouse). */
  import { colones } from '../lib/formato.ts';

  let { meses }: { meses: { nombre: string; ingresos: number; gastos: number; ganancia: number }[] } = $props();

  // Colores revisados: se distinguen con daltonismo y contrastan con el fondo.
  const AZUL = '#1E6BA8';
  const CAFE = '#B07A1F';

  const ANCHO = 720;
  const ALTO = 240;
  const IZQ = 64;
  const ABAJO = 26;
  const ARRIBA = 10;
  const area = ALTO - ABAJO - ARRIBA;
  const grupo = (ANCHO - IZQ) / 12;
  const barra = Math.min(18, (grupo - 10) / 2);

  const maximo = $derived(Math.max(1, ...meses.flatMap((m) => [m.ingresos, m.gastos])));
  /** Escala "redonda" para las líneas de guía. */
  const tope = $derived.by(() => {
    const p = 10 ** Math.floor(Math.log10(maximo));
    const pasos = [1, 2, 2.5, 5, 10].map((x) => x * p);
    return pasos.find((x) => x >= maximo) ?? maximo;
  });
  const y = (v: number) => ARRIBA + area - (v / tope) * area;
  const guias = $derived([0, 0.25, 0.5, 0.75, 1].map((f) => f * tope));
  const corto = (v: number) => (v >= 1_000_000 ? `₡${(v / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}M` : v >= 1000 ? `₡${Math.round(v / 1000)}k` : `₡${v}`);

  /** Barra con las esquinas de arriba redondeadas, pegada a la base. */
  function forma(x: number, valor: number): string {
    if (valor <= 0) return '';
    const top = y(valor);
    const base = y(0);
    const r = Math.min(4, (base - top) / 2, barra / 2);
    return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barra - r} Q${x + barra},${top} ${x + barra},${top + r} V${base} Z`;
  }

  let activo = $state<number | null>(null);
</script>

<div class="grafico">
  <div class="leyenda" aria-hidden="true">
    <span><i style:background={AZUL}></i>Ingresos</span>
    <span><i style:background={CAFE}></i>Gastos</span>
  </div>
  <svg viewBox="0 0 {ANCHO} {ALTO}" role="img" aria-label="Ingresos y gastos por mes. El detalle está en la tabla de abajo." onmouseleave={() => (activo = null)}>
    {#each guias as g}
      <line x1={IZQ} x2={ANCHO} y1={y(g)} y2={y(g)} class="guia" />
      <text x={IZQ - 8} y={y(g) + 4} class="eje" text-anchor="end">{corto(g)}</text>
    {/each}
    {#each meses as m, i}
      {@const x0 = IZQ + i * grupo + (grupo - (barra * 2 + 2)) / 2}
      {#if activo === i}<rect x={IZQ + i * grupo} y={ARRIBA} width={grupo} height={area} class="resalte" />{/if}
      <path d={forma(x0, m.ingresos)} fill={AZUL} />
      <path d={forma(x0 + barra + 2, m.gastos)} fill={CAFE} />
      <text x={IZQ + i * grupo + grupo / 2} y={ALTO - 8} class="eje" text-anchor="middle">{m.nombre.slice(0, 3)}</text>
      <!-- Zona sensible más grande que las barras -->
      <rect
        x={IZQ + i * grupo}
        y={ARRIBA}
        width={grupo}
        height={area + ABAJO}
        fill="transparent"
        role="presentation"
        onmouseenter={() => (activo = i)}
        onclick={() => (activo = activo === i ? null : i)}
      />
    {/each}
  </svg>
  {#if activo !== null}
    {@const m = meses[activo]}
    <div class="detalle" style:left="{Math.min(80, Math.max(8, ((IZQ + activo * grupo + grupo / 2) / ANCHO) * 100))}%">
      <strong>{m.nombre}</strong>
      <span><i style:background={AZUL}></i>Ingresos <b>{colones(m.ingresos)}</b></span>
      <span><i style:background={CAFE}></i>Gastos <b>{colones(m.gastos)}</b></span>
      <span>Ganancia <b>{colones(m.ganancia)}</b></span>
    </div>
  {/if}
</div>

<style>
  .grafico {
    position: relative;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .leyenda {
    display: flex;
    gap: 16px;
    font-size: 0.85rem;
    color: var(--suave);
    margin-bottom: 6px;
  }
  .leyenda span,
  .detalle span {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  i {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    display: inline-block;
  }
  .guia {
    stroke: #e6e0d4;
    stroke-width: 1;
  }
  .eje {
    font-size: 11px;
    fill: #7a7266;
  }
  .resalte {
    fill: #f1ece2;
  }
  .detalle {
    position: absolute;
    top: 28px;
    transform: translateX(-50%);
    background: var(--blanco);
    border: 1px solid var(--linea);
    border-radius: 8px;
    box-shadow: var(--sombra);
    padding: 8px 10px;
    font-size: 0.85rem;
    display: grid;
    gap: 2px;
    pointer-events: none;
    white-space: nowrap;
  }
  .detalle b {
    margin-left: auto;
    padding-left: 10px;
  }
</style>
