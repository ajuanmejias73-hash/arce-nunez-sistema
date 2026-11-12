<script lang="ts">
  import { datos } from '../lib/datos.svelte.ts';
  import { sesion } from '../lib/sesion.svelte.ts';
  import Imagen from '../componentes/Imagen.svelte';

  const usuarios = $derived(datos.c?.ajustes.usuarios ?? []);
  const largoMax = $derived(Math.max(4, ...usuarios.map((u) => u.pin.length)));

  let pin = $state('');
  let error = $state(false);

  function tocar(d: string) {
    if (pin.length >= largoMax) return;
    error = false;
    pin += d;
    if (sesion.entrar(pin, usuarios)) return;
    if (pin.length >= largoMax) {
      error = true;
      setTimeout(() => (pin = ''), 450);
    }
  }

  function borrar() {
    pin = pin.slice(0, -1);
    error = false;
  }

  function tecla(ev: KeyboardEvent) {
    if (/^\d$/.test(ev.key)) tocar(ev.key);
    else if (ev.key === 'Backspace') borrar();
  }

  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
</script>

<svelte:window onkeydown={tecla} />

<main class="pantalla">
  <div class="caja">
    <Imagen ruta={datos.c?.ajustes.empresa.logo ?? ''} alt="Logo" clase="logo" />
    <h1>{datos.c?.ajustes.empresa.nombre}</h1>
    <p class="sub">Digitá tu PIN</p>

    <div class="puntos" class:error aria-live="polite" aria-label="{pin.length} de {largoMax} números">
      {#each { length: largoMax } as _, i}
        <span class:lleno={i < pin.length}></span>
      {/each}
    </div>
    <p class="mensaje" role="alert">{error ? 'PIN incorrecto' : ''}</p>

    <div class="teclado">
      {#each teclas as t}
        <button onclick={() => tocar(t)}>{t}</button>
      {/each}
      <span></span>
      <button onclick={() => tocar('0')}>0</button>
      <button class="borrar" onclick={borrar} aria-label="Borrar">⌫</button>
    </div>
  </div>
</main>

<style>
  .pantalla {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: 24px 16px;
    background: var(--carbon);
    color: var(--blanco);
  }
  .caja {
    text-align: center;
    width: min(320px, 100%);
  }
  .caja :global(.logo) {
    width: 72px;
    height: 100px;
    object-fit: contain;
    border-radius: 6px;
  }
  h1 {
    letter-spacing: 0.1em;
    margin: 10px 0 2px;
    color: var(--dorado-claro);
  }
  .sub {
    color: #bdb6aa;
    margin: 0 0 18px;
  }
  .puntos {
    display: flex;
    justify-content: center;
    gap: 14px;
  }
  .puntos span {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid var(--dorado);
  }
  .puntos span.lleno {
    background: var(--dorado);
  }
  .puntos.error span {
    border-color: #e07a6c;
    background: #e07a6c;
    animation: temblar 0.35s;
  }
  @keyframes temblar {
    25% {
      transform: translateX(-5px);
    }
    75% {
      transform: translateX(5px);
    }
  }
  .mensaje {
    min-height: 1.4em;
    color: #f0a397;
    margin: 10px 0;
  }
  .teclado {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .teclado button {
    aspect-ratio: 1.35;
    font-size: 1.6rem;
    font-weight: 400;
    background: #3e3e3e;
    color: var(--blanco);
    border: 1px solid #4a4a4a;
    border-radius: 14px;
  }
  .teclado button:active {
    background: var(--dorado);
    color: var(--carbon-2);
  }
  .teclado .borrar {
    background: transparent;
    border-color: transparent;
  }
</style>
