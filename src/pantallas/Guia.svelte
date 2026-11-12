<script lang="ts">
  import { rutas } from '../lib/rutas.svelte.ts';
</script>

<h1>Guía</h1>
<p class="ayuda">Cómo se usa el sistema, en corto.</p>

<div class="guia">
  <section class="tarjeta">
    <h2>1. Hacer una cotización</h2>
    <ol>
      <li>Tocá <button class="enlace" onclick={() => rutas.ir('nueva')}>+ Nueva cotización</button> y escogé cliente nuevo o uno que ya existe.</li>
      <li>Llená los datos del cliente y escogé el <strong>modo de precio</strong>: "Total a mano" (escribís el total) o "Partes + materiales" (suma los montos de las Partes).</li>
      <li>Escribí las <strong>Partes del trabajo</strong>: una cosa por renglón (Enter crea el siguiente). Con "Lo ve / Oculto" decidís qué ve el cliente; lo oculto igual cuenta en el total.</li>
      <li>Tocá <strong>Ver cotización</strong> para verla como la ve el cliente.</li>
      <li>Tocá <strong>Guardar en historial</strong>. Queda como v1.</li>
      <li>Mandala con <strong>WhatsApp: imagen</strong> o <strong>WhatsApp: PDF</strong>.</li>
    </ol>
    <p class="ayuda">Lo que escribís se guarda solo en el dispositivo mientras tanto: si se cierra la página, no se pierde.</p>
  </section>

  <section class="tarjeta">
    <h2>2. Cambiar una cotización</h2>
    <ul>
      <li><button class="enlace" onclick={() => rutas.ir('modificar')}>Modificar cotización</button>: al guardar queda como v2, v3… La anterior no se borra.</li>
      <li><strong>Usar de base</strong> (en el Historial): hace una cotización <em>nueva</em> con número y fecha nuevos, copiando todo lo demás.</li>
      <li>En el <button class="enlace" onclick={() => rutas.ir('historial')}>Historial</button> se cambia el estado (Pendiente, Aceptada…) y se ven todas las versiones.</li>
    </ul>
  </section>

  <section class="tarjeta">
    <h2>3. Calculadora</h2>
    <p>Escogé la calculadora, cambiá las medidas y tocá <strong>Agregar a la cotización</strong>: pregunta en cuál Parte y si el cliente lo ve, y agrega el renglón, los materiales y (mano de obra) el monto a la cotización abierta.</p>
  </section>

  <section class="tarjeta">
    <h2>4. Plata</h2>
    <ul>
      <li><strong>Pago de cliente</strong>: escogé la cotización; el sistema sugiere el adelanto o lo que falta, y pone solo la categoría y el estado (Aceptada o Pagada).</li>
      <li><strong>Gasto</strong>: materiales, combustible, etc. Si es de una obra, escogela para ver la ganancia por obra.</li>
      <li><strong>Planilla</strong>: registrá las horas de cada trabajador; al <strong>Pagar planilla</strong> se marcan pagadas y se crea el gasto de cada obra.</li>
      <li><button class="enlace" onclick={() => rutas.ir('contabilidad')}>Contabilidad</button>: resumen del mes y del año, gastos por categoría y ganancia por obra.</li>
    </ul>
  </section>

  <section class="tarjeta">
    <h2>5. Cuidados</h2>
    <ul>
      <li>Todo lo que se guarda queda con el nombre de quien lo hizo (Pablo o Lin).</li>
      <li>Si los dos usan el sistema a la vez, la página se pone al día sola cada poco y avisa los cambios del otro.</li>
      <li>No le pasen el token de GitHub a nadie. Si se pierde un celular, borren ese token en GitHub y saquen otro.</li>
      <li>De vez en cuando descarguen un <button class="enlace" onclick={() => rutas.ir('ajustes')}>Respaldo</button> (en Ajustes).</li>
    </ul>
  </section>
</div>

<style>
  .guia {
    display: grid;
    gap: 16px;
    max-width: 820px;
  }
  .guia .tarjeta + .tarjeta {
    margin-top: 0;
  }
  li {
    margin: 6px 0;
  }
  .enlace {
    background: none;
    border: none;
    padding: 0;
    min-height: 0;
    color: var(--dorado-osc);
    text-decoration: underline;
    font-weight: 700;
    font-size: inherit;
  }
</style>
