<script lang="ts">
  /** Rendimientos y mezclas de la Calculadora (se guardan en Ajustes). */
  import { datos } from '../lib/datos.svelte.ts';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { aNumero } from '../lib/formato.ts';
  import { RENDIMIENTOS_POR_DEFECTO } from '../lib/normalizar.ts';
  import { sesion } from '../lib/sesion.svelte.ts';
  import type { Mezcla } from '../lib/tipos.ts';

  const ETIQUETAS: Record<string, string> = {
    pinturaM2PorGalonPorMano: 'Pintura: m² por galón por mano',
    galonesPorCubeta: 'Galones por cubeta',
    selladorM2PorGalon: 'Sellador: m² por galón',
    m2PorLamina: 'Lámina 1,22 × 2,44: m² por lámina',
    largoStudTrack: 'Largo de stud / track (m)',
    tornillosPorLamina: 'Tornillos por lámina',
    mallaMPorM2: 'Malla/cinta: m por m² forrado',
    metrosPorRolloMalla: 'Metros por rollo de malla',
    repelloM2PorSaco: 'Repello/basecoat: m² por saco',
    ceramicaM2PorSacoPegamento: 'Cerámica: m² por saco de pegamento',
    ceramicaM2PorBolsaFragua: 'Cerámica: m² por bolsa de fragua',
    largoTubo: 'Largo comercial de tubo/varilla (m)',
    techoTornillosPorLamina: 'Techo: tornillos por lámina',
    techoTraslape: 'Techo: traslape (m)',
    metrosPorVara: 'Metros por vara',
  };

  const aTexto = (r: Record<string, number>) => Object.fromEntries(Object.keys(ETIQUETAS).map((k) => [k, String(r[k] ?? RENDIMIENTOS_POR_DEFECTO[k])]));
  const mezclasTexto = (m: Mezcla[]) => m.map((x) => ({ tipo: x.tipo, cemento: String(x.cemento), arena: String(x.arena), piedra: String(x.piedra), agua: String(x.agua) }));

  let rend = $state(aTexto(datos.c!.ajustes.rendimientos));
  let mezclas = $state(mezclasTexto(datos.c!.ajustes.mezclas));
  let guardando = $state(false);

  const cambio = $derived(
    JSON.stringify(rend) !== JSON.stringify(aTexto(datos.c!.ajustes.rendimientos)) || JSON.stringify(mezclas) !== JSON.stringify(mezclasTexto(datos.c!.ajustes.mezclas)),
  );

  async function guardar() {
    const r: Record<string, number> = {};
    for (const [k, t] of Object.entries(rend)) {
      const v = aNumero(t);
      if (v === null || v <= 0) return dialogos.avisar(`«${ETIQUETAS[k]}» debe ser un número mayor que 0.`, 'error');
      r[k] = v;
    }
    const m: Mezcla[] = [];
    for (const x of mezclas) {
      if (!x.tipo.trim()) continue;
      const vals = [x.cemento, x.arena, x.piedra, x.agua].map(aNumero);
      if (vals.some((v) => v === null || v < 0)) return dialogos.avisar(`Revisá los números de «${x.tipo}».`, 'error');
      m.push({ tipo: x.tipo.trim(), cemento: vals[0]!, arena: vals[1]!, piedra: vals[2]!, agua: vals[3]! });
    }
    if (!m.length) return dialogos.avisar('Tiene que quedar al menos una mezcla.', 'error');
    guardando = true;
    try {
      await datos.modificar(
        'ajustes',
        (a) => {
          a.rendimientos = { ...a.rendimientos, ...r };
          a.mezclas = m;
        },
        'cambió los rendimientos de la calculadora',
        sesion.quien,
      );
      rend = aTexto(datos.c!.ajustes.rendimientos);
      mezclas = mezclasTexto(datos.c!.ajustes.mezclas);
      dialogos.avisar('Guardado');
    } catch (e) {
      dialogos.fallo(e);
    } finally {
      guardando = false;
    }
  }
</script>

<section class="tarjeta">
  <h2>Rendimientos</h2>
  <p class="ayuda">Lo que rinde cada material. Las calculadoras los usan para sus cuentas. "Limpiar calculadora" no los toca.</p>
  <div class="campos">
    {#each Object.keys(ETIQUETAS) as k}
      <label>{ETIQUETAS[k]} <input bind:value={rend[k]} inputmode="decimal" /></label>
    {/each}
  </div>
</section>

<section class="tarjeta">
  <h2>Mezclas por m³</h2>
  <div class="mezclas">
    <div class="fila cabeza" aria-hidden="true"><span>Mezcla</span><span>Cemento (sacos 50 kg)</span><span>Arena (m³)</span><span>Piedra (m³)</span><span>Agua (L)</span><span></span></div>
    {#each mezclas as x, i}
      <div class="fila">
        <input bind:value={x.tipo} aria-label="Mezcla {i + 1}" />
        <input bind:value={x.cemento} inputmode="decimal" aria-label="Cemento {x.tipo}" />
        <input bind:value={x.arena} inputmode="decimal" aria-label="Arena {x.tipo}" />
        <input bind:value={x.piedra} inputmode="decimal" aria-label="Piedra {x.tipo}" />
        <input bind:value={x.agua} inputmode="decimal" aria-label="Agua {x.tipo}" />
        <button class="quitar" onclick={() => mezclas.splice(i, 1)} aria-label="Quitar {x.tipo}">×</button>
      </div>
    {/each}
  </div>
  <button class="btn-borde btn-chico" onclick={() => mezclas.push({ tipo: '', cemento: '0', arena: '0', piedra: '0', agua: '0' })}>+ Mezcla</button>
</section>

<div class="acciones pie">
  <button class="btn" onclick={guardar} disabled={!cambio || guardando}>{guardando ? 'Guardando…' : 'Guardar rendimientos y mezclas'}</button>
  {#if cambio}<button class="btn-borde" onclick={() => ((rend = aTexto(datos.c!.ajustes.rendimientos)), (mezclas = mezclasTexto(datos.c!.ajustes.mezclas)))}>Deshacer</button>{/if}
</div>

<style>
  .mezclas {
    display: grid;
    gap: 6px;
    margin-bottom: 10px;
  }
  .fila {
    display: grid;
    grid-template-columns: 1.6fr 1fr 1fr 1fr 1fr 36px;
    gap: 6px;
    align-items: center;
  }
  .fila input {
    margin: 0;
    min-width: 0;
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
  .pie {
    margin-top: 16px;
  }
  @media (max-width: 640px) {
    .fila {
      grid-template-columns: 1fr 1fr 36px;
    }
    .fila > input:first-child {
      grid-column: 1 / -1;
    }
    .cabeza {
      display: none;
    }
  }
</style>
