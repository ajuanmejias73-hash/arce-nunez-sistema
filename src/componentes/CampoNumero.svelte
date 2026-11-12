<script lang="ts">
  /**
   * Casilla para escribir montos o números. Acepta "2,000", "₡2,000" o "1,5".
   * `factor` = 100 para porcentajes (se escribe 50, se guarda 0.5).
   */
  import { aNumero, colones } from '../lib/formato.ts';

  let {
    valor = $bindable(),
    factor = 1,
    dinero = false,
    etiqueta,
    placeholder = '',
    deshabilitado = false,
  }: {
    valor: number | null;
    factor?: number;
    dinero?: boolean;
    etiqueta: string;
    placeholder?: string;
    deshabilitado?: boolean;
  } = $props();

  const mostrar = (n: number | null) => {
    if (n === null || n === undefined) return '';
    const v = Math.round(n * factor * 1000) / 1000;
    return dinero ? colones(v).replace('₡', '') : String(v);
  };

  let texto = $state(mostrar(valor));
  let enfocado = false;

  // Si el valor cambia desde afuera (cargar otra cotización), actualizar lo que se ve.
  $effect(() => {
    const v = valor;
    if (!enfocado) texto = mostrar(v);
  });

  function escribir() {
    const n = aNumero(texto);
    valor = n === null ? null : n / factor;
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
  inputmode="decimal"
  aria-label={etiqueta}
  placeholder={placeholder || (dinero ? '₡' : '')}
  disabled={deshabilitado}
  class:dinero
/>

<style>
  .dinero {
    text-align: right;
  }
</style>
