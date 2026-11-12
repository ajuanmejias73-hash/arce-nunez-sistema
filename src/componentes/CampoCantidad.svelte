<script lang="ts">
  /** Cantidad de un material: un número ("2.5", "1,000") o un texto ("pendiente", "el cliente define"). */
  import { aNumero } from '../lib/formato.ts';

  let { valor = $bindable(), etiqueta }: { valor: number | string | null; etiqueta: string } = $props();

  const mostrar = (v: number | string | null) => (v === null ? '' : String(v));
  let texto = $state(mostrar(valor));
  let enfocado = false;

  $effect(() => {
    const v = valor;
    if (!enfocado) texto = mostrar(v);
  });

  function escribir() {
    const t = texto.trim();
    const n = aNumero(t);
    valor = t === '' ? null : n !== null && /^[\d\s.,]+$/.test(t) ? n : t;
  }
</script>

<input
  bind:value={texto}
  oninput={escribir}
  onfocus={() => (enfocado = true)}
  onblur={() => {
    enfocado = false;
    texto = mostrar(valor);
  }}
  aria-label={etiqueta}
/>
