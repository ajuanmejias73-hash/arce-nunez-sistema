<script lang="ts">
  import type { Snippet } from 'svelte';
  import { datos } from '../lib/datos.svelte.ts';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { esPrueba, conexionGuardada } from '../lib/conexion.ts';
  import { sesion } from '../lib/sesion.svelte.ts';
  import { GRUPOS, MODULOS, rutas } from '../lib/rutas.svelte.ts';
  import { editor } from '../lib/editor.svelte.ts';
  import Imagen from './Imagen.svelte';

  let { children }: { children: Snippet } = $props();

  let menuAbierto = $state(false);
  const prueba = esPrueba(conexionGuardada());

  /** Cada cuánto se revisa si la otra persona guardó algo (mientras la página está a la vista). */
  const CADA_SEGUNDOS = 20;

  async function revisar() {
    if (document.hidden) return;
    const mensaje = await datos.revisarCambios();
    if (mensaje === null || !datos.c) return;
    sesion.actualizar(datos.c.ajustes.usuarios);
    // Solo se avisa cuando el cambio lo hizo otra persona.
    const [quien, ...resto] = mensaje.split(': ');
    if (quien !== sesion.usuario && resto.length) dialogos.avisar(`${quien} ${resto.join(': ')}`);
  }

  // Revisión automática: cada 20 segundos y al volver a la página (cambiar de app o de pestaña).
  $effect(() => {
    const reloj = setInterval(revisar, CADA_SEGUNDOS * 1000);
    const alVolver = () => !document.hidden && revisar();
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    return () => {
      clearInterval(reloj);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
    };
  });

  async function salir() {
    if (datos.guardando > 0) {
      const ok = await dialogos.confirmar('Todavía se está guardando', '¿Salir de todas formas?', { si: 'Salir' });
      if (!ok) return;
    }
    sesion.salir();
    rutas.ir('inicio');
  }

  function ir(ruta: string) {
    menuAbierto = false;
    rutas.ir(ruta);
  }
</script>

<header class="barra">
  <button class="marca" onclick={() => ir('inicio')} aria-label="Ir al inicio">
    <Imagen ruta={datos.c?.ajustes.empresa.logo ?? ''} alt="" clase="logo-mini" />
    <span>{datos.c?.ajustes.empresa.nombre}</span>
  </button>

  <div class="derecha">
    {#if datos.guardando > 0}<span class="guardando" role="status">Guardando…</span>{/if}
    <span class="persona" title="Persona que está usando el sistema">{sesion.usuario}</span>
    <button class="btn-barra" onclick={salir}>Salir</button>
    <button class="btn-barra menu" aria-expanded={menuAbierto} aria-controls="menu-principal" onclick={() => (menuAbierto = !menuAbierto)}>
      ☰ Menú
    </button>
  </div>
</header>

{#if prueba}
  <div class="prueba">Estás usando DATOS DE PRUEBA de esta compu. Nada de esto llega a los datos reales.</div>
{/if}

<div class="cuerpo">
  <nav id="menu-principal" class:abierto={menuAbierto} aria-label="Menú principal">
    <button class:activo={rutas.actual === 'inicio'} onclick={() => ir('inicio')}>Inicio</button>
    {#each GRUPOS as g}
      <p class="grupo">{g}</p>
      {#if g === 'Cotizaciones' && editor.d}
        <!-- La cotización que está abierta, para volver a ella desde cualquier pantalla. -->
        <button class="abierta" class:activo={rutas.actual === 'cotizacion'} onclick={() => ir('cotizacion')}>
          ✎ {editor.d.numero}{editor.d.cliente.trim() ? ' · ' + editor.d.cliente.trim() : ''}
          {#if editor.sinGuardar}<span class="punto" title="Sin guardar">sin guardar</span>{/if}
        </button>
      {/if}
      {#each MODULOS.filter((m) => m.grupo === g) as m}
        <button class:activo={rutas.actual === m.ruta || (m.ruta === 'historial' && rutas.actual.startsWith('ver/'))} class:nueva={m.ruta === 'nueva'} onclick={() => ir(m.ruta)}>{m.nombre}</button>
      {/each}
    {/each}
  </nav>

  <main class="contenido">
    {@render children()}
  </main>
</div>

<style>
  .barra {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 16px;
    background: var(--carbon);
    color: var(--blanco);
    border-bottom: 3px solid var(--dorado);
  }
  .marca {
    display: flex;
    align-items: center;
    gap: 10px;
    background: none;
    border: none;
    color: var(--dorado-claro);
    padding: 0;
    font-size: 1.05rem;
    letter-spacing: 0.08em;
  }
  .marca :global(.logo-mini) {
    width: 30px;
    height: 41px;
    object-fit: contain;
  }
  .derecha {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .persona {
    background: var(--dorado);
    color: var(--carbon-2);
    border-radius: 999px;
    padding: 4px 12px;
    font-weight: 700;
  }
  .guardando {
    color: var(--dorado-claro);
    font-size: 0.85rem;
  }
  .btn-barra {
    background: transparent;
    color: var(--blanco);
    border: 1px solid #5a5a5a;
    padding: 5px 10px;
    min-height: 36px;
    font-weight: 500;
  }
  .btn-barra:hover:not(:disabled) {
    border-color: var(--dorado);
  }
  .menu {
    display: none;
  }
  .prueba {
    background: #fff1c9;
    color: #6b4d00;
    text-align: center;
    font-size: 0.85rem;
    padding: 6px 16px;
    border-bottom: 1px solid #ecd58f;
  }
  .cuerpo {
    display: grid;
    grid-template-columns: 210px 1fr;
    min-height: calc(100dvh - 60px);
  }
  nav {
    background: var(--blanco);
    border-right: 1px solid var(--linea);
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  nav button {
    text-align: left;
    background: transparent;
    border: none;
    font-weight: 500;
    padding: 9px 12px;
    color: var(--texto);
  }
  nav button:hover {
    background: var(--fondo);
  }
  nav button.activo {
    background: var(--dorado-claro);
    font-weight: 700;
  }
  nav button.nueva {
    background: var(--dorado);
    color: var(--carbon-2);
    font-weight: 700;
    margin-bottom: 2px;
  }
  nav button.nueva.activo,
  nav button.nueva:hover {
    background: #c7a76b;
  }
  nav button.abierta {
    border: 1px dashed var(--dorado);
    font-size: 0.9rem;
    margin-bottom: 4px;
  }
  .punto {
    display: block;
    font-size: 0.72rem;
    color: #8a6400;
    font-weight: 700;
  }
  .grupo {
    margin: 14px 12px 4px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--suave);
  }
  .contenido {
    padding: 20px;
    min-width: 0;
    max-width: 1440px;
  }

  @media (max-width: 860px) {
    .cuerpo {
      grid-template-columns: 1fr;
    }
    .menu {
      display: inline-block;
    }
    nav {
      display: none;
      border-right: none;
      border-bottom: 1px solid var(--linea);
    }
    nav.abierto {
      display: flex;
    }
    .contenido {
      padding: 16px;
    }
    .marca span {
      display: none;
    }
  }
</style>
