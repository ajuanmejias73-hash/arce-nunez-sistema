<script lang="ts">
  /**
   * La cotización bonita que ve el cliente. Mide siempre 800 px de ancho (para que el PDF
   * y la imagen salgan iguales en compu y en celular); en pantalla se achica para caber.
   * Cada pedazo que no se debe partir entre páginas del PDF lleva data-bloque.
   */
  import type { ModeloVista } from '../lib/modelo.ts';
  import Imagen from './Imagen.svelte';

  let { v }: { v: ModeloVista } = $props();
</script>

<article class="hoja">
  <header class="cabeza" data-bloque>
    <div class="marca">
      <div class="logo"><Imagen ruta={v.empresa.logo} alt="" clase="logo-img" /></div>
      <div>
        <div class="empresa">{v.empresa.nombre}</div>
        {#if v.empresa.lema}<div class="lema">{v.empresa.lema}</div>{/if}
        {#if v.empresa.telefonos}<div class="contacto">Tel. {v.empresa.telefonos}</div>{/if}
        {#if v.empresa.responsable}<div class="contacto">{v.empresa.responsable}</div>{/if}
        {#if v.empresa.correo}<div class="contacto">{v.empresa.correo}</div>{/if}
      </div>
    </div>
    <div class="titulo">
      <div class="palabra">COTIZACIÓN</div>
      <div><span>N.º</span> {v.numero}</div>
      <div><span>Fecha</span> {v.fecha}</div>
      {#if v.validaHasta}<div><span>Válida hasta</span> {v.validaHasta}</div>{/if}
    </div>
  </header>

  <div class="cuerpo">
    {#if v.datosCliente.length}
      <section class="cliente" data-bloque>
        {#each v.datosCliente as p}
          <div class="par"><span>{p.etiqueta}</span><strong>{p.valor}</strong></div>
        {/each}
      </section>
    {/if}

    {#if v.partes.length}
      <section class="trabajo">
        <div class="tabla-cabeza" class:con-monto={v.mostrarMontos} data-bloque="titulo">
          <div>TIPO DE TRABAJO</div>
          <div>DESCRIPCIÓN DEL TRABAJO</div>
          {#if v.mostrarMontos}<div class="der">MONTO</div>{/if}
        </div>
        {#each v.partes as p}
          <div class="parte" class:con-monto={v.mostrarMontos} data-bloque>
            <div class="parte-nombre">
              {#if p.etiqueta}<div class="romano">{p.etiqueta}</div>{/if}
              {#if p.nombre}<div class="nombre">{p.nombre}</div>{/if}
            </div>
            <div class="renglones">
              {#each p.renglones as r}<div>{r}</div>{/each}
            </div>
            {#if v.mostrarMontos}<div class="monto der">{p.monto}</div>{/if}
          </div>
        {/each}
      </section>
    {/if}

    {#if v.materiales}
      <section class="bloque-titulo" data-bloque="titulo"><h3>LISTA DE MATERIALES</h3></section>
      <section class="materiales">
        <div class="mat-fila mat-cabeza" class:precios={v.materiales.conPrecios} data-bloque="titulo">
          <div>MATERIAL</div>
          <div class="der">CANT.</div>
          <div>UNIDAD</div>
          {#if v.materiales.conPrecios}<div class="der">P. UNITARIO</div><div class="der">TOTAL</div>{/if}
        </div>
        {#each v.materiales.filas as f}
          <div class="mat-fila" class:precios={v.materiales.conPrecios} data-bloque>
            <div>{f.material}</div>
            <div class="der">{f.cantidad}</div>
            <div>{f.unidad}</div>
            {#if v.materiales.conPrecios}<div class="der">{f.precio}</div><div class="der">{f.total}</div>{/if}
          </div>
        {/each}
        {#if v.materiales.total}
          <div class="mat-total" data-bloque><span>Total materiales</span><strong>{v.materiales.total}</strong></div>
        {/if}
      </section>
    {/if}

    {#if v.notas.length}
      <section class="bloque-titulo" data-bloque="titulo"><h3>NOTAS</h3></section>
      <section class="notas">
        {#each v.notas as n}<p data-bloque>{n}</p>{/each}
      </section>
    {/if}

    {#if v.fotos.length}
      <section class="bloque-titulo" data-bloque="titulo"><h3>IMÁGENES DE REFERENCIA <small>— Solo para ilustración</small></h3></section>
      <section class="fotos">
        {#each { length: Math.ceil(v.fotos.length / 3) } as _, fila}
          <div class="fotos-fila" data-bloque>
            {#each v.fotos.slice(fila * 3, fila * 3 + 3) as f}
              <div class="foto"><Imagen ruta={f} alt="Imagen de referencia" clase="foto-img" /></div>
            {/each}
          </div>
        {/each}
      </section>
    {/if}

    <section class="monto-seccion" data-bloque>
      <h3>MONTO EN COLONES</h3>
      <div class="monto-cuerpo">
        <div class="pagos">
          <div class="pagos-titulo">Medios de pago</div>
          {#each v.pagos as p}<div>{p}</div>{/each}
        </div>
        <div class="desglose">
          {#each v.desglose as l}
            <div class="par-monto"><span>{l.etiqueta}</span><span>{l.valor}</span></div>
          {/each}
        </div>
      </div>
      <div class="total">
        <span>TOTAL A PAGAR</span>
        <div>
          <strong>{v.total}</strong>
          {#if v.ivaIncluido}<small>IVA incluido</small>{/if}
        </div>
      </div>
      {#if v.adelantoSaldo.length}
        <div class="adelanto">
          {#each v.adelantoSaldo as l}<div class="par-monto"><span>{l.etiqueta}</span><strong>{l.valor}</strong></div>{/each}
        </div>
      {/if}
    </section>

    {#if v.clausulas.length}
      <section class="bloque-titulo" data-bloque="titulo"><h3>CONDICIONES DEL CONTRATO</h3></section>
      <section class="clausulas">
        {#each v.clausulas as c, i}
          <p data-bloque><strong>{i + 1}. {c.titulo}.</strong> {c.texto}</p>
        {/each}
      </section>
    {/if}

    <section class="firmas" data-bloque>
      <div>
        <div class="linea"></div>
        <strong>{v.empresa.responsable || v.empresa.nombre}</strong>
        <span>{v.empresa.nombre}</span>
      </div>
      <div>
        <div class="linea"></div>
        <strong>Aceptación del cliente: {v.cliente}</strong>
        <span>Firma y fecha</span>
      </div>
    </section>
  </div>

  <footer class="pie" data-bloque>
    {[v.empresa.pie, v.empresa.nombre, v.empresa.telefonos ? 'Tel. ' + v.empresa.telefonos : ''].filter(Boolean).join(' · ')}
  </footer>
</article>

<style>
  .hoja {
    --c: #323232;
    --d: #b8975a;
    --dc: #e6d7b8;
    --f: #f5f2ec;
    --l: #d9d2c5;
    width: 800px;
    background: #fff;
    color: #2b2b2b;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    line-height: 1.45;
  }
  .der {
    text-align: right;
  }

  /* Encabezado */
  .cabeza {
    background: var(--c);
    color: #fff;
    display: flex;
    justify-content: space-between;
    gap: 20px;
    padding: 24px 32px;
    border-bottom: 4px solid var(--d);
  }
  .marca {
    display: flex;
    gap: 16px;
    align-items: center;
  }
  .logo :global(.logo-img) {
    width: 64px;
    height: 88px;
    object-fit: contain;
    display: block;
  }
  .empresa {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: var(--dc);
  }
  .lema {
    color: var(--d);
    font-size: 12px;
    margin-bottom: 4px;
  }
  .contacto {
    font-size: 12px;
    color: #ddd;
  }
  .titulo {
    text-align: right;
    font-size: 12px;
    color: #ddd;
    white-space: nowrap;
  }
  .titulo span {
    color: var(--d);
  }
  .palabra {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--d);
    margin-bottom: 6px;
  }

  .cuerpo {
    padding: 22px 32px 26px;
  }
  section + section {
    margin-top: 0;
  }
  h3 {
    margin: 0;
    font-size: 13px;
    letter-spacing: 0.08em;
    color: var(--c);
  }
  h3 small {
    font-weight: 400;
    letter-spacing: 0;
    color: #777;
  }
  .bloque-titulo {
    padding: 20px 0 8px;
    border-bottom: 2px solid var(--d);
    margin-bottom: 4px;
  }

  /* Cliente */
  .cliente {
    background: var(--f);
    border: 1px solid var(--l);
    border-radius: 6px;
    padding: 12px 16px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 24px;
    margin-bottom: 20px;
  }
  .par {
    display: flex;
    gap: 8px;
  }
  .par span {
    color: #7a7266;
    min-width: 120px;
  }

  /* Tabla de trabajo */
  .tabla-cabeza,
  .parte {
    display: grid;
    grid-template-columns: 190px 1fr;
    gap: 16px;
  }
  .tabla-cabeza.con-monto,
  .parte.con-monto {
    grid-template-columns: 190px 1fr 110px;
  }
  .tabla-cabeza {
    background: var(--c);
    color: var(--dc);
    font-weight: 700;
    font-size: 11.5px;
    letter-spacing: 0.06em;
    padding: 9px 12px;
  }
  .parte {
    padding: 11px 12px;
    border-bottom: 1px solid var(--l);
  }
  .romano {
    color: var(--d);
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.06em;
  }
  .nombre {
    font-weight: 700;
  }
  .monto {
    font-weight: 700;
  }

  /* Materiales */
  .mat-fila {
    display: grid;
    grid-template-columns: 1fr 150px 90px;
    gap: 12px;
    padding: 6px 12px;
    border-bottom: 1px solid #ece6da;
  }
  .mat-fila.precios {
    grid-template-columns: 1fr 90px 70px 100px 100px;
  }
  .mat-cabeza {
    background: var(--c);
    color: var(--dc);
    font-weight: 700;
    font-size: 11.5px;
    letter-spacing: 0.06em;
    border: none;
  }
  .mat-total {
    display: flex;
    justify-content: flex-end;
    gap: 24px;
    padding: 8px 12px;
    background: var(--f);
  }

  /* Notas y fotos */
  .notas p {
    margin: 6px 0;
  }
  .fotos-fila {
    display: flex;
    justify-content: center;
    gap: 12px;
    padding: 6px 0;
  }
  .foto {
    width: 236px;
    height: 180px;
    background: var(--f);
    border: 1px solid var(--l);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .foto :global(.foto-img) {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    display: block;
  }

  /* Monto */
  .monto-seccion {
    margin-top: 22px;
    border: 1px solid var(--l);
    border-radius: 6px;
    overflow: hidden;
  }
  .monto-seccion h3 {
    padding: 10px 16px;
    background: var(--f);
    border-bottom: 1px solid var(--l);
  }
  .monto-cuerpo {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    padding: 12px 16px;
  }
  .pagos {
    font-size: 12px;
    color: #555;
  }
  .pagos-titulo {
    font-weight: 700;
    color: var(--c);
    margin-bottom: 2px;
  }
  .par-monto {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 2px 0;
  }
  .total {
    background: var(--c);
    color: #fff;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
  }
  .total > span {
    font-weight: 700;
    letter-spacing: 0.08em;
  }
  .total div {
    text-align: right;
  }
  .total strong {
    display: block;
    font-size: 26px;
    color: var(--d);
    letter-spacing: 0.02em;
  }
  .total small {
    color: var(--dc);
  }
  .adelanto {
    padding: 8px 16px;
    margin-left: 50%;
  }

  /* Cláusulas y firmas */
  .clausulas p {
    margin: 7px 0;
    text-align: justify;
    font-size: 12px;
  }
  .firmas {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 48px;
    margin-top: 48px;
    text-align: center;
    font-size: 12px;
  }
  .firmas strong,
  .firmas span {
    display: block;
  }
  .firmas span {
    color: #777;
  }
  .linea {
    border-top: 1px solid #555;
    margin-bottom: 6px;
  }
  .pie {
    background: var(--c);
    color: var(--dc);
    text-align: center;
    padding: 12px 32px;
    font-size: 12px;
    letter-spacing: 0.04em;
  }
</style>
