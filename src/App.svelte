<script lang="ts">
  import { conexionGuardada } from './lib/conexion.ts';
  import { datos } from './lib/datos.svelte.ts';
  import { sesion } from './lib/sesion.svelte.ts';
  import { MODULOS, ETAPA_ACTUAL, rutas } from './lib/rutas.svelte.ts';
  import Dialogos from './componentes/Dialogos.svelte';
  import Exportador from './componentes/Exportador.svelte';
  import Marco from './componentes/Marco.svelte';
  import Conectar from './pantallas/Conectar.svelte';
  import Pin from './pantallas/Pin.svelte';
  import Inicio from './pantallas/Inicio.svelte';
  import Ajustes from './pantallas/Ajustes.svelte';
  import Catalogos from './pantallas/Catalogos.svelte';
  import Nueva from './pantallas/Nueva.svelte';
  import Modificar from './pantallas/Modificar.svelte';
  import Cotizacion from './pantallas/Cotizacion.svelte';
  import Historial from './pantallas/Historial.svelte';
  import VerCotizacion from './pantallas/VerCotizacion.svelte';
  import Contabilidad from './pantallas/Contabilidad.svelte';
  import Movimientos from './pantallas/Movimientos.svelte';
  import Planilla from './pantallas/Planilla.svelte';
  import Guia from './pantallas/Guia.svelte';
  import Proximamente from './pantallas/Proximamente.svelte';

  // Al abrir: si este dispositivo ya tiene su conexión guardada, cargar los datos.
  const guardada = conexionGuardada();
  if (guardada) {
    datos.conectar(guardada).then(() => {
      if (datos.c) sesion.restaurar(datos.c.ajustes.usuarios);
    });
  }

  const modulo = $derived(MODULOS.find((m) => m.ruta === rutas.actual));
</script>

{#if datos.estado !== 'listo' || !datos.c}
  <Conectar />
{:else if !sesion.usuario}
  <Pin />
{:else}
  <Marco>
    {#if rutas.actual === 'ajustes'}
      <Ajustes />
    {:else if rutas.actual === 'catalogos'}
      <Catalogos />
    {:else if rutas.actual === 'nueva'}
      <Nueva />
    {:else if rutas.actual === 'modificar'}
      <Modificar />
    {:else if rutas.actual === 'cotizacion'}
      <Cotizacion />
    {:else if rutas.actual === 'historial'}
      <Historial />
    {:else if rutas.actual.startsWith('ver/')}
      <VerCotizacion />
    {:else if rutas.actual === 'contabilidad'}
      <Contabilidad />
    {:else if rutas.actual === 'movimientos'}
      <Movimientos />
    {:else if rutas.actual === 'planilla'}
      <Planilla />
    {:else if rutas.actual === 'guia'}
      <Guia />
    {:else if modulo && modulo.etapa > ETAPA_ACTUAL}
      <Proximamente {modulo} />
    {:else}
      <Inicio />
    {/if}
  </Marco>
  <Exportador />
{/if}

<Dialogos />
