<script lang="ts">
  import type { Modulo } from '../lib/rutas.svelte.ts';

  let { modulo }: { modulo: Modulo } = $props();
</script>

<h1>{modulo.nombre}</h1>
<div class="tarjeta vacio">
  <p><strong>Próximamente.</strong></p>
  <p>{modulo.descripcion}. Esta pantalla se construye en la etapa {modulo.etapa}.</p>
</div>
