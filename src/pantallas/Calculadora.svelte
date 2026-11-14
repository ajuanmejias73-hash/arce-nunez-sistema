<script lang="ts" module>
  import type { PlanoTexto } from '../componentes/PlanoCalc.svelte';
  import type { FormaManoObra, TipoArea } from '../lib/calculadoras.ts';

  /** Medir con los m² directos o con largo × alto (metros lineales). */
  type Modo = 'm2' | 'medidas';

  /** Valores de ejemplo con que arranca (y vuelve con "Limpiar") cada calculadora. */
  function ejemplos() {
    const vacia = (tipo: TipoArea = 'Pared') => ({ descripcion: '', largo: '', alto: '', cantidad: '1', tipo });
    return {
      areas: {
        superficies: [
          { descripcion: 'Pared del frente', largo: '4', alto: '2.5', cantidad: '1', tipo: 'Pared' as TipoArea },
          { descripcion: 'Paredes laterales', largo: '3', alto: '2.5', cantidad: '2', tipo: 'Pared' as TipoArea },
          vacia(),
        ],
        aberturas: [{ descripcion: 'Puerta', largo: '0.9', alto: '2.1', cantidad: '1' }, { descripcion: 'Ventana', largo: '1.2', alto: '1', cantidad: '1' }, { descripcion: '', largo: '', alto: '', cantidad: '1' }],
      },
      plano: {
        alto: '2.50',
        cuartos: [{ nombre: '', largo: '', ancho: '', estimado: false }],
        aberturas: [{ tipo: 'Puerta' as 'Puerta' | 'Ventana', nombre: '', ancho: '', alto: '2.10', cantidad: '1', estimado: false }],
        paredes: [],
        techos: [],
        losas: [],
        tubos: [],
        notas: [],
        respuesta: '',
      } as PlanoTexto,
      pisos: {
        espacios: [
          { nombre: 'Cuarto', largo: '3.5', ancho: '4' },
          { nombre: 'Baño', largo: '2.25', ancho: '2.2' },
          { nombre: '', largo: '', ancho: '' },
        ],
        ceramica: true,
        desperdicio: '10',
        m2PorCaja: '1.5',
        nombreCeramica: 'Cerámica antideslizante',
        rodapie: true,
        anchoPuertas: '0',
        contrapiso: false,
        tipo: '',
        espesor: '8',
        desperdicioConcreto: '5',
      },
      pintura: { modo: 'm2' as Modo, m2: '50', largo: '10', alto: '2.5', manos: '2', sellador: false, desperdicio: '10' },
      durock: {
        modo: 'medidas' as Modo,
        largo: '6',
        alto: '3',
        aberturas: '0',
        m2Interna: '18',
        m2Externa: '18',
        interna: { lleva: true, lamina: 'Lámina Durock 1,22 x 2,44 m de 1/2"', repello: true },
        externa: { lleva: true, lamina: 'Lámina Durock 1,22 x 2,44 m de 1/2"', repello: true },
        separacion: '0.41',
        esquineros: '0',
        desperdicio: '10',
      },
      ceramica: { modo: 'm2' as Modo, m2: '20', largo: '5', ancho: '4', desperdicio: '10', m2PorCaja: '1.5', nombre: 'Cerámica antideslizante' },
      concreto: { tipo: '', largo: '3', ancho: '3', espesor: '10', cantidad: '1', desperdicio: '5' },
      techo: { largo: '4', ancho: '6', pendiente: '15', largoLamina: '3.66', anchoUtil: '0.80', lamina: 'Lámina de policarbonato', canoa: true },
      estructura: {
        filas: [
          { material: 'Tubo 2x4"', medida: '2.5', cortes: '4', largoPieza: '6' },
          { material: 'Tubo galvanizado 2x1" (1,20)', medida: '1.2', cortes: '10', largoPieza: '6' },
          { material: '', medida: '', cortes: '', largoPieza: '6' },
          { material: '', medida: '', cortes: '', largoPieza: '6' },
          { material: '', medida: '', cortes: '', largoPieza: '6' },
          { material: '', medida: '', cortes: '', largoPieza: '6' },
        ],
        desperdicio: '5',
      },
      mano: { servicio: '', forma: 'Por hora' as FormaManoObra, cantidad: '40', precio: '3500', personas: '2', imprevistos: '0' },
      conversion: { valor: '1' },
    };
  }
  type Calc = keyof ReturnType<typeof ejemplos>;
  // Se mantiene mientras se navega entre pantallas.
  const estado = $state(ejemplos());
  /** Lo que la persona cambió en "¿Agregar?" de cada resultado. */
  const marcas = $state<Record<string, Record<string, boolean>>>({});
  /** Cuánto pide de más (+) o de menos (−) de cada material, por calculadora. */
  const extra = $state<Record<string, Record<string, number>>>({});
  let pestanaGuardada: Calc | 'rendimientos' = 'areas';
</script>

<script lang="ts">
  import * as C from '../lib/calculadoras.ts';
  import type { Resultado } from '../lib/calculadoras.ts';
  import type { Losa, Plano, Techo, Tubo } from '../lib/plano.ts';
  import PlanoCalc from '../componentes/PlanoCalc.svelte';
  import { datos } from '../lib/datos.svelte.ts';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { editor } from '../lib/editor.svelte.ts';
  import { aNumero, colones } from '../lib/formato.ts';
  import { FORMAS_COBRO } from '../lib/tipos.ts';
  import DialogoAgregar from '../componentes/DialogoAgregar.svelte';
  import Rendimientos from '../componentes/Rendimientos.svelte';

  const PESTANAS: { id: Calc | 'rendimientos'; nombre: string }[] = [
    { id: 'plano', nombre: '📐 Plano' },
    { id: 'areas', nombre: 'Áreas' },
    { id: 'pisos', nombre: 'Pisos' },
    { id: 'pintura', nombre: 'Pintura' },
    { id: 'durock', nombre: 'Durock / gypsum' },
    { id: 'ceramica', nombre: 'Cerámica' },
    { id: 'concreto', nombre: 'Concreto y mortero' },
    { id: 'techo', nombre: 'Techos' },
    { id: 'estructura', nombre: 'Estructura metálica' },
    { id: 'mano', nombre: 'Mano de obra' },
    { id: 'conversion', nombre: 'Conversiones' },
    { id: 'rendimientos', nombre: '⚙ Rendimientos' },
  ];

  let pestana = $state(pestanaGuardada);
  $effect(() => {
    pestanaGuardada = pestana;
  });

  const n = (t: string) => aNumero(t) ?? 0;
  const pct = (t: string) => n(t) / 100;
  const r = $derived(datos.c!.ajustes.rendimientos);
  const mezclas = $derived(datos.c!.ajustes.mezclas);
  const catalogo = $derived(datos.c!.materiales);
  const servicios = $derived(datos.c!.servicios);

  // ---- Resultados (se recalculan al escribir) ----
  const area = $derived(
    C.areas(
      estado.areas.superficies.map((s) => ({ descripcion: s.descripcion, largo: n(s.largo), alto: n(s.alto), cantidad: n(s.cantidad), tipo: s.tipo })),
      estado.areas.aberturas.map((s) => ({ descripcion: s.descripcion, largo: n(s.largo), alto: n(s.alto), cantidad: n(s.cantidad) })),
    ),
  );
  const mezcla = $derived(mezclas.find((m) => m.tipo === estado.concreto.tipo) ?? mezclas[0]);
  $effect(() => {
    if (mezclas[0] && !mezclas.some((m) => m.tipo === estado.concreto.tipo)) estado.concreto.tipo = mezclas[0].tipo;
    // Contrapiso: por defecto la mezcla de 175 (la de pisos), o la primera.
    if (mezclas[0] && !mezclas.some((m) => m.tipo === estado.pisos.tipo)) estado.pisos.tipo = (mezclas.find((m) => m.tipo.includes('175')) ?? mezclas[0]).tipo;
  });

  // m² según cómo se midió: directo, o largo × alto (metros lineales).
  const m2Pintura = $derived(estado.pintura.modo === 'm2' ? n(estado.pintura.m2) : n(estado.pintura.largo) * n(estado.pintura.alto));
  const m2Ceramica = $derived(estado.ceramica.modo === 'm2' ? n(estado.ceramica.m2) : n(estado.ceramica.largo) * n(estado.ceramica.ancho));
  const m2Caras = $derived.by(() => {
    const d = estado.durock;
    if (d.modo === 'm2') return { interna: n(d.m2Interna), externa: n(d.m2Externa) };
    const cara = Math.max(0, n(d.largo) * n(d.alto) - n(d.aberturas));
    return { interna: cara, externa: cara };
  });

  const resultados = $derived<Record<Calc, Resultado | null>>({
    areas: area.resultado,
    pintura: C.pintura({ m2: m2Pintura, manos: n(estado.pintura.manos), sellador: estado.pintura.sellador, desperdicio: pct(estado.pintura.desperdicio) }, r),
    durock: C.paredes(
      {
        largo: n(estado.durock.largo),
        alto: n(estado.durock.alto),
        separacion: n(estado.durock.separacion),
        esquineros: n(estado.durock.esquineros),
        desperdicio: pct(estado.durock.desperdicio),
        interna: { ...estado.durock.interna, m2: m2Caras.interna },
        externa: { ...estado.durock.externa, m2: m2Caras.externa },
      },
      r,
    ),
    ceramica: C.ceramica({ m2: m2Ceramica, desperdicio: pct(estado.ceramica.desperdicio), m2PorCaja: n(estado.ceramica.m2PorCaja), nombre: estado.ceramica.nombre }, r),
    concreto: mezcla
      ? C.concreto({ mezcla, largo: n(estado.concreto.largo), ancho: n(estado.concreto.ancho), espesorCm: n(estado.concreto.espesor), cantidad: n(estado.concreto.cantidad), desperdicio: pct(estado.concreto.desperdicio) })
      : null,
    techo: C.techo(
      {
        largo: n(estado.techo.largo),
        ancho: n(estado.techo.ancho),
        pendiente: pct(estado.techo.pendiente),
        largoLamina: n(estado.techo.largoLamina),
        anchoUtil: n(estado.techo.anchoUtil),
        lamina: estado.techo.lamina,
        canoa: estado.techo.canoa,
      },
      r,
    ),
    estructura: C.estructura(
      estado.estructura.filas.map((f) => ({ material: f.material, medida: n(f.medida), cortes: n(f.cortes), largoPieza: n(f.largoPieza) })),
      pct(estado.estructura.desperdicio),
    ),
    mano: C.manoDeObra({ forma: estado.mano.forma, cantidad: n(estado.mano.cantidad), precio: n(estado.mano.precio), personas: n(estado.mano.personas), imprevistos: pct(estado.mano.imprevistos) }),
    conversion: null,
    plano: null,
    pisos: C.pisos(
      estado.pisos.espacios.map((e) => ({ nombre: e.nombre, largo: n(e.largo), ancho: n(e.ancho) })),
      {
        ceramica: estado.pisos.ceramica,
        desperdicio: pct(estado.pisos.desperdicio),
        m2PorCaja: n(estado.pisos.m2PorCaja),
        nombreCeramica: estado.pisos.nombreCeramica,
        rodapie: estado.pisos.rodapie,
        anchoPuertas: n(estado.pisos.anchoPuertas),
        contrapiso: estado.pisos.contrapiso,
        mezcla: mezclas.find((m) => m.tipo === estado.pisos.tipo) ?? mezclas[0] ?? null,
        espesorCm: n(estado.pisos.espesor),
        desperdicioConcreto: pct(estado.pisos.desperdicioConcreto),
      },
      r,
    ),
  });

  // ---- Puertas y ventanas para Paredes, de un toque ----
  const huecosPlano = $derived(Math.round(estado.plano.aberturas.reduce((s, a) => s + n(a.ancho) * n(a.alto) * (n(a.cantidad) || 1), 0) * 100) / 100);
  function sumarHueco(m2: number) {
    estado.durock.aberturas = String(Math.round((n(estado.durock.aberturas) + m2) * 100) / 100);
  }

  // ---- Plano → otras calculadoras ----
  const texto = (x: number) => String(Math.round(x * 100) / 100);

  function pasarAPisos(plano: Plano, anchoPuertas: number) {
    estado.pisos.espacios = plano.cuartos.filter((c) => c.largo > 0 && c.ancho > 0).map((c) => ({ nombre: c.nombre, largo: texto(c.largo), ancho: texto(c.ancho) }));
    estado.pisos.anchoPuertas = texto(anchoPuertas);
    pestana = 'pisos';
    dialogos.avisar('Espacios pasados a Pisos. Escogé si lleva cerámica, rodapié o contrapiso.');
  }

  async function pasarAAreas(plano: Plano, cuartos: { nombre: string; perimetro: number }[]) {
    const ok = await dialogos.confirmar('¿Pasar las paredes a Áreas?', 'Lo que hay ahora en Áreas se reemplaza por las paredes y aberturas del plano.', { si: 'Pasar' });
    if (!ok) return;
    estado.areas.superficies = cuartos.map((c) => ({ descripcion: `Paredes de ${c.nombre}`, largo: texto(c.perimetro), alto: texto(plano.altoParedes), cantidad: '1', tipo: 'Pared' as TipoArea }));
    estado.areas.aberturas = plano.aberturas
      .filter((a) => a.ancho > 0 && a.alto > 0)
      .map((a) => ({ descripcion: a.nombre, largo: texto(a.ancho), alto: texto(a.alto), cantidad: String(a.cantidad || 1) }));
    pestana = 'areas';
    dialogos.avisar('Paredes pasadas a Áreas. Desde Pintura o Cerámica podés usar el área neta.');
  }

  function agregarResumenPlano(renglon: string) {
    paraAgregar = { renglon, materiales: [] };
  }

  /** Paredes nuevas del plano → Paredes (Durock / gypsum), por m² de cada cara. */
  function pasarAParedes(plano: Plano) {
    const paredes = plano.paredes.filter((w) => w.largo > 0 && w.alto > 0);
    const huecos = plano.aberturas.reduce((s, a) => s + a.ancho * a.alto * a.cantidad, 0);
    const interna = paredes.reduce((s, w) => s + w.largo * w.alto, 0);
    const externa = paredes.filter((w) => w.caras === 2).reduce((s, w) => s + w.largo * w.alto, 0);
    const d = estado.durock;
    d.modo = 'm2';
    // Las puertas y ventanas se restan de cada cara que tenga paredes.
    d.m2Interna = texto(Math.max(0, interna - huecos));
    d.m2Externa = texto(Math.max(0, externa - (externa > 0 ? huecos : 0)));
    d.interna.lleva = interna > 0;
    d.externa.lleva = externa > 0;
    d.largo = texto(paredes.reduce((s, w) => s + w.largo, 0));
    d.alto = texto(Math.max(0, ...paredes.map((w) => w.alto)));
    pestana = 'durock';
    dialogos.avisar('Paredes pasadas: escogé la lámina de cada cara.');
  }

  function pasarATecho(t: Techo) {
    Object.assign(estado.techo, { largo: texto(t.largo), ancho: texto(t.ancho), pendiente: texto(t.pendiente) });
    pestana = 'techo';
    dialogos.avisar(`Techo «${t.nombre}» pasado. Revisá el tipo y el largo de la lámina.`);
  }

  function pasarALosa(l: Losa) {
    Object.assign(estado.concreto, { largo: texto(l.largo), ancho: texto(l.ancho), espesor: texto(l.espesorCm), cantidad: '1' });
    pestana = 'concreto';
    dialogos.avisar(`«${l.nombre}» pasada a Concreto. Escogé la mezcla.`);
  }

  function pasarAEstructura(tubos: Tubo[]) {
    const largo = estado.estructura.filas.find((x) => x.largoPieza)?.largoPieza || String(r.largoTubo ?? 6);
    estado.estructura.filas = tubos.map((t) => ({ material: t.material, medida: texto(t.medida), cortes: String(t.cortes), largoPieza: largo }));
    pestana = 'estructura';
    dialogos.avisar('Tubos pasados a Estructura metálica. Revisá el material y el largo de cada pieza.');
  }

  const accionesPlano = {
    pisos: (plano: Plano, anchoPuertas: number) => pasarAPisos(plano, anchoPuertas),
    areas: (plano: Plano, cuartos: { nombre: string; perimetro: number }[]) => pasarAAreas(plano, cuartos),
    paredes: pasarAParedes,
    techo: pasarATecho,
    losa: pasarALosa,
    estructura: pasarAEstructura,
    agregar: agregarResumenPlano,
  };

  const redondo = (x: number) => Math.round(x * 100) / 100;

  /**
   * El resultado de la pestaña con lo que cambió la persona: "¿Agregar?" y cuánto pide
   * de más o de menos (se guarda la diferencia, así si cambian las medidas se mantiene).
   */
  const actual = $derived.by(() => {
    if (pestana === 'rendimientos') return null;
    const res = resultados[pestana];
    if (!res) return null;
    const m = marcas[pestana] ?? {};
    const d = extra[pestana] ?? {};
    return {
      ...res,
      materiales: res.materiales.map((x) => {
        const cantidad = Math.max(0, redondo(x.cantidad + (d[x.material] ?? 0)));
        return { ...x, cantidad, calculado: x.cantidad, agregar: (m[x.material] ?? x.agregar) && cantidad > 0 };
      }),
    };
  });

  const precioDe = (nombre: string) => catalogo.find((m) => m.material === nombre)?.precio ?? null;

  function marcar(nombre: string, valor: boolean) {
    if (pestana === 'rendimientos') return;
    (marcas[pestana] ??= {})[nombre] = valor;
  }

  /** Pedir otra cantidad distinta a la calculada. */
  function pedir(nombre: string, calculado: number, nueva: number) {
    if (pestana === 'rendimientos' || !Number.isFinite(nueva)) return;
    (extra[pestana] ??= {})[nombre] = redondo(Math.max(0, nueva) - calculado);
    // Si pide algo de un material que estaba en 0 o sin marcar, se marca para agregar.
    if (nueva > 0) (marcas[pestana] ??= {})[nombre] = true;
  }

  /** De a 1 para unidades, sacos y láminas; de a 0.1 para m³ o cantidades con decimales. */
  const paso = (calculado: number, unidad: string) => (unidad === 'm³' || !Number.isInteger(calculado) ? 0.1 : 1);

  let paraAgregar = $state<Resultado | null>(null);

  function agregar() {
    if (actual) paraAgregar = $state.snapshot(actual) as Resultado;
  }

  async function limpiar() {
    if (pestana === 'rendimientos') return;
    const nombre = PESTANAS.find((p) => p.id === pestana)!.nombre;
    if (!(await dialogos.confirmar(`¿Limpiar "${nombre}"?`, 'Vuelve a los valores de ejemplo. Los rendimientos no cambian.', { si: 'Limpiar' }))) return;
    const e = ejemplos();
    (estado as Record<string, unknown>)[pestana] = e[pestana];
    delete marcas[pestana];
    delete extra[pestana];
  }

  function elegirServicio() {
    const s = servicios.find((x) => x.servicio === estado.mano.servicio);
    if (!s) return;
    estado.mano.forma = s.formaCobro;
    if (s.precio !== null) estado.mano.precio = String(s.precio);
  }

  const UNIDAD_MANO: Record<FormaManoObra, string> = { 'Por hora': 'Horas', 'Por m²': 'm²', 'Por metro lineal': 'Metros', 'Por día': 'Días', 'Precio fijo': '' };
</script>

<h1>Calculadora de obra</h1>
<p class="destino">
  {#if editor.d}
    Lo que agregués va a <strong>{editor.d.numero}{editor.d.cliente.trim() ? ' · ' + editor.d.cliente.trim() : ''}</strong>.
  {:else}
    No hay ninguna cotización abierta: al agregar, se puede crear una nueva.
  {/if}
</p>

<div class="pestanas" role="tablist" aria-label="Calculadoras">
  {#each PESTANAS as p}
    <button role="tab" aria-selected={pestana === p.id} class:activa={pestana === p.id} onclick={() => (pestana = p.id)}>{p.nombre}</button>
  {/each}
</div>

{#snippet campo(etiqueta: string, obj: Record<string, unknown>, clave: string, ayuda = '')}
  <label>
    {etiqueta}
    <input value={obj[clave] as string} oninput={(e) => (obj[clave] = e.currentTarget.value)} inputmode="decimal" />
    {#if ayuda}<span class="ayuda">{ayuda}</span>{/if}
  </label>
{/snippet}

{#snippet siNo(etiqueta: string, obj: Record<string, unknown>, clave: string)}
  <label class="casilla"><input type="checkbox" checked={obj[clave] as boolean} onchange={(e) => (obj[clave] = e.currentTarget.checked)} /> {etiqueta}</label>
{/snippet}

{#snippet medirPor(obj: { modo: 'm2' | 'medidas' }, medidas: string)}
  <div class="medir" role="radiogroup" aria-label="Medir por">
    <span>Medir por:</span>
    <label class:activo={obj.modo === 'medidas'}><input type="radio" name="medir" checked={obj.modo === 'medidas'} onchange={() => (obj.modo = 'medidas')} /> {medidas}</label>
    <label class:activo={obj.modo === 'm2'}><input type="radio" name="medir" checked={obj.modo === 'm2'} onchange={() => (obj.modo = 'm2')} /> m² directo</label>
  </div>
{/snippet}

<!-- Botones para usar en este campo las áreas que se anotaron en "Áreas" (por tipo). -->
{#snippet usarArea(obj: Record<string, unknown>, clave: string)}
  {@const opciones = C.TIPOS_AREA.filter((t) => area.porTipo[t] > 0 && n(obj[clave] as string) !== area.porTipo[t])}
  {#if opciones.length}
    <div class="usar-area">
      <span>De "Áreas":</span>
      {#each opciones as t}
        <button
          class="btn-borde btn-chico"
          onclick={() => {
            obj[clave] = String(area.porTipo[t]);
            if ('modo' in obj) obj.modo = 'm2';
          }}>{C.PLURAL_AREA[t]} {C.num(area.porTipo[t])} m²</button
        >
      {/each}
    </div>
  {/if}
{/snippet}

{#if pestana === 'rendimientos'}
  <Rendimientos />
{:else if pestana === 'plano'}
  <PlanoCalc p={estado.plano} acciones={accionesPlano} />
{:else}
  <section class="tarjeta calc">
    <div class="datos">
      <h2>Datos</h2>

      {#if pestana === 'areas'}
        <h3>Superficies</h3>
        <div class="filas">
          <div class="fila con-tipo cabeza" aria-hidden="true"><span>Descripción</span><span>Para</span><span>Largo (m)</span><span>Alto/ancho (m)</span><span>Cant.</span><span></span></div>
          {#each estado.areas.superficies as s, i}
            <div class="fila con-tipo">
              <input bind:value={s.descripcion} aria-label="Superficie {i + 1}" placeholder="Superficie {i + 1}" />
              <select bind:value={s.tipo} aria-label="Para qué es la superficie {i + 1}">
                {#each C.TIPOS_AREA as t}<option value={t}>{t}</option>{/each}
              </select>
              <input bind:value={s.largo} inputmode="decimal" aria-label="Largo {i + 1}" />
              <input bind:value={s.alto} inputmode="decimal" aria-label="Alto {i + 1}" />
              <input bind:value={s.cantidad} inputmode="decimal" aria-label="Cantidad {i + 1}" />
              <button class="quitar" onclick={() => estado.areas.superficies.splice(i, 1)} aria-label="Quitar superficie {i + 1}">×</button>
            </div>
          {/each}
        </div>
        <button class="btn-borde btn-chico" onclick={() => estado.areas.superficies.push({ descripcion: '', largo: '', alto: '', cantidad: '1', tipo: estado.areas.superficies.at(-1)?.tipo ?? 'Pared' })}>+ Superficie</button>
        <h3>Puertas y ventanas (se restan de las paredes)</h3>
        <div class="filas">
          {#each estado.areas.aberturas as s, i}
            <div class="fila">
              <input bind:value={s.descripcion} aria-label="Abertura {i + 1}" placeholder="Abertura {i + 1}" />
              <input bind:value={s.largo} inputmode="decimal" aria-label="Ancho abertura {i + 1}" />
              <input bind:value={s.alto} inputmode="decimal" aria-label="Alto abertura {i + 1}" />
              <input bind:value={s.cantidad} inputmode="decimal" aria-label="Cantidad abertura {i + 1}" />
              <button class="quitar" onclick={() => estado.areas.aberturas.splice(i, 1)} aria-label="Quitar abertura {i + 1}">×</button>
            </div>
          {/each}
        </div>
        <button class="btn-borde btn-chico" onclick={() => estado.areas.aberturas.push({ descripcion: '', largo: '', alto: '', cantidad: '1' })}>+ Abertura</button>
        <div class="totales">
          {#if area.paredBruta > 0}
            <span class="linea-total">
              Paredes: {C.num(area.paredBruta)} m²
              {#if area.aberturas > 0}− puertas y ventanas {C.num(area.aberturas)} m²{/if}
              = <strong>{C.num(area.porTipo.Pared)} m² netos</strong>
            </span>
          {/if}
          {#each C.TIPOS_AREA.filter((t) => t !== 'Pared' && area.porTipo[t] > 0) as t}
            <span class="linea-total">{C.PLURAL_AREA[t]}: <strong>{C.num(area.porTipo[t])} m²</strong></span>
          {/each}
          {#if area.paredBruta === 0 && area.aberturas > 0}
            <span class="linea-total">Puertas y ventanas: <strong>−{C.num(area.aberturas)} m²</strong> (no hay paredes: se restan del total)</span>
          {/if}
          {#if C.TIPOS_AREA.filter((t) => area.porTipo[t] > 0).length > 1}
            <span class="linea-total">Total de todo: <strong>{C.num(area.neta)} m²</strong></span>
          {/if}
        </div>
        <p class="ayuda">En Pintura, Paredes, Cerámica y Mano de obra salen botones para usar cada una de estas áreas con un toque.</p>
      {:else if pestana === 'pisos'}
        <h3>Espacios</h3>
        <div class="filas">
          <div class="fila cabeza pisos" aria-hidden="true"><span>Nombre</span><span>Largo (m)</span><span>Ancho (m)</span><span></span></div>
          {#each estado.pisos.espacios as e, i}
            <div class="fila pisos">
              <input bind:value={e.nombre} aria-label="Espacio {i + 1}" placeholder="Espacio {i + 1}" />
              <input bind:value={e.largo} inputmode="decimal" aria-label="Largo {i + 1}" />
              <input bind:value={e.ancho} inputmode="decimal" aria-label="Ancho {i + 1}" />
              <button class="quitar" onclick={() => estado.pisos.espacios.splice(i, 1)} aria-label="Quitar espacio {i + 1}">×</button>
            </div>
          {/each}
        </div>
        <button class="btn-borde btn-chico" onclick={() => estado.pisos.espacios.push({ nombre: '', largo: '', ancho: '' })}>+ Espacio</button>

        <h3>¿Qué lleva?</h3>
        <div class="campos">
          {@render siNo('Cerámica o porcelanato', estado.pisos, 'ceramica')}
          {@render siNo('Rodapié', estado.pisos, 'rodapie')}
          {@render siNo('Contrapiso de concreto', estado.pisos, 'contrapiso')}
        </div>
        {#if estado.pisos.ceramica || estado.pisos.rodapie}
          <h3>Cerámica y rodapié</h3>
          <div class="campos">
            {#if estado.pisos.ceramica}
              <label>Nombre de la cerámica <input bind:value={estado.pisos.nombreCeramica} list="calc-materiales" /></label>
              {@render campo('m² por caja', estado.pisos, 'm2PorCaja')}
            {/if}
            {@render campo('Desperdicio (%)', estado.pisos, 'desperdicio', '10% normal, 15% en diagonal')}
            {#if estado.pisos.rodapie}{@render campo('Ancho total de puertas (m)', estado.pisos, 'anchoPuertas', 'Ahí no va rodapié')}{/if}
          </div>
        {/if}
        {#if estado.pisos.contrapiso}
          <h3>Contrapiso</h3>
          <div class="campos">
            <label>
              Mezcla
              <select bind:value={estado.pisos.tipo}>
                {#each mezclas as m}<option value={m.tipo}>{m.tipo}</option>{/each}
              </select>
            </label>
            {@render campo('Espesor (cm)', estado.pisos, 'espesor')}
            {@render campo('Desperdicio del concreto (%)', estado.pisos, 'desperdicioConcreto')}
          </div>
        {/if}
      {:else if pestana === 'pintura'}
        {@render medirPor(estado.pintura, 'Largo × alto')}
        <div class="campos">
          {#if estado.pintura.modo === 'm2'}
            {@render campo('Área (m²)', estado.pintura, 'm2')}
          {:else}
            {@render campo('Largo (metros lineales)', estado.pintura, 'largo')}
            {@render campo('Alto (m)', estado.pintura, 'alto')}
          {/if}
          {@render campo('Manos', estado.pintura, 'manos')}
          {@render campo('Desperdicio (%)', estado.pintura, 'desperdicio')}
          {@render siNo('¿Lleva sellador?', estado.pintura, 'sellador')}
        </div>
        {#if estado.pintura.modo === 'medidas'}<p class="ayuda">Área: {C.num(Math.round(m2Pintura * 100) / 100)} m²</p>{/if}
        {@render usarArea(estado.pintura, 'm2')}
      {:else if pestana === 'durock'}
        {@render medirPor(estado.durock, 'Largo × alto')}
        <div class="campos">
          {#if estado.durock.modo === 'medidas'}
            {@render campo('Largo (metros lineales)', estado.durock, 'largo')}
            {@render campo('Alto (m)', estado.durock, 'alto')}
            <div class="huecos">
              {@render campo('Puertas y ventanas (m²)', estado.durock, 'aberturas', 'Se restan de cada cara')}
              <div class="acciones">
                <button class="btn-borde btn-chico" onclick={() => sumarHueco(0.9 * 2.1)}>+ Puerta (0.90 × 2.10)</button>
                <button class="btn-borde btn-chico" onclick={() => sumarHueco(1.2 * 1)}>+ Ventana (1.20 × 1.00)</button>
                {#if area.aberturas > 0}<button class="btn-borde btn-chico" onclick={() => (estado.durock.aberturas = String(area.aberturas))}>Las de Áreas: {C.num(area.aberturas)} m²</button>{/if}
                {#if huecosPlano > 0}<button class="btn-borde btn-chico" onclick={() => (estado.durock.aberturas = String(huecosPlano))}>Las del Plano: {C.num(huecosPlano)} m²</button>{/if}
                {#if n(estado.durock.aberturas) > 0}<button class="enlace" onclick={() => (estado.durock.aberturas = '0')}>Poner en 0</button>{/if}
              </div>
            </div>
          {:else}
            {@render campo('m² de la cara interna', estado.durock, 'm2Interna')}
            {@render campo('m² de la cara externa', estado.durock, 'm2Externa')}
            {@render campo('Largo (m) para la estructura', estado.durock, 'largo', 'Opcional: para studs y tracks')}
            {@render campo('Alto (m) para la estructura', estado.durock, 'alto')}
          {/if}
        </div>
        <div class="usar-caras">
          <div><strong>Cara interna</strong> {@render usarArea(estado.durock, 'm2Interna')}</div>
          <div><strong>Cara externa</strong> {@render usarArea(estado.durock, 'm2Externa')}</div>
        </div>
        <div class="caras">
          {#each [{ c: estado.durock.interna, t: 'Cara interna', m2: m2Caras.interna }, { c: estado.durock.externa, t: 'Cara externa', m2: m2Caras.externa }] as x}
            <fieldset class="cara" class:apagada={!x.c.lleva}>
              <legend><label class="casilla"><input type="checkbox" bind:checked={x.c.lleva} /> {x.t}</label></legend>
              <label>Lámina <input bind:value={x.c.lamina} list="calc-materiales" disabled={!x.c.lleva} /></label>
              <label class="casilla"><input type="checkbox" bind:checked={x.c.repello} disabled={!x.c.lleva} /> Lleva repello en saco</label>
              {#if x.c.lleva}<p class="ayuda">{C.num(Math.round(x.m2 * 100) / 100)} m²</p>{/if}
            </fieldset>
          {/each}
        </div>
        <div class="campos">
          {@render campo('Separación de studs (m)', estado.durock, 'separacion')}
          {@render campo('Esquineros', estado.durock, 'esquineros')}
          {@render campo('Desperdicio (%)', estado.durock, 'desperdicio')}
        </div>
      {:else if pestana === 'ceramica'}
        {@render medirPor(estado.ceramica, 'Largo × ancho')}
        <div class="campos">
          {#if estado.ceramica.modo === 'm2'}
            {@render campo('Área (m²)', estado.ceramica, 'm2')}
          {:else}
            {@render campo('Largo (m)', estado.ceramica, 'largo')}
            {@render campo('Ancho (m)', estado.ceramica, 'ancho')}
          {/if}
          {@render campo('Desperdicio (%)', estado.ceramica, 'desperdicio', '10% normal, 15% en diagonal')}
          {@render campo('m² por caja', estado.ceramica, 'm2PorCaja')}
          <label>Nombre de la cerámica <input bind:value={estado.ceramica.nombre} list="calc-materiales" /></label>
        </div>
        {#if estado.ceramica.modo === 'medidas'}<p class="ayuda">Área: {C.num(Math.round(m2Ceramica * 100) / 100)} m²</p>{/if}
        {@render usarArea(estado.ceramica, 'm2')}
      {:else if pestana === 'concreto'}
        <div class="campos">
          <label>
            Tipo de mezcla
            <select bind:value={estado.concreto.tipo}>
              {#each mezclas as m}<option value={m.tipo}>{m.tipo}</option>{/each}
            </select>
          </label>
          {@render campo('Largo (m)', estado.concreto, 'largo')}
          {@render campo('Ancho (m)', estado.concreto, 'ancho')}
          {@render campo('Espesor (cm)', estado.concreto, 'espesor')}
          {@render campo('Cantidad', estado.concreto, 'cantidad')}
          {@render campo('Desperdicio (%)', estado.concreto, 'desperdicio')}
        </div>
      {:else if pestana === 'techo'}
        <div class="campos">
          {@render campo('Largo de caída, horizontal (m)', estado.techo, 'largo')}
          {@render campo('Ancho / frente (m)', estado.techo, 'ancho')}
          {@render campo('Pendiente (%)', estado.techo, 'pendiente')}
          {@render campo('Largo de lámina (m)', estado.techo, 'largoLamina')}
          {@render campo('Ancho útil de lámina (m)', estado.techo, 'anchoUtil')}
          <label>Tipo de lámina <input bind:value={estado.techo.lamina} list="calc-materiales" /></label>
          {@render siNo('¿Lleva canoa?', estado.techo, 'canoa')}
        </div>
      {:else if pestana === 'estructura'}
        <div class="filas">
          <div class="fila cabeza estructura" aria-hidden="true"><span>Material</span><span>Medida de cada corte (m)</span><span>N.º de cortes</span><span>Largo de pieza (m)</span><span></span></div>
          {#each estado.estructura.filas as f, i}
            <div class="fila estructura">
              <input bind:value={f.material} list="calc-materiales" aria-label="Material {i + 1}" placeholder="Material {i + 1}" />
              <input bind:value={f.medida} inputmode="decimal" aria-label="Medida {i + 1}" />
              <input bind:value={f.cortes} inputmode="decimal" aria-label="Cortes {i + 1}" />
              <input bind:value={f.largoPieza} inputmode="decimal" aria-label="Largo de pieza {i + 1}" />
              <button class="quitar" onclick={() => estado.estructura.filas.splice(i, 1)} aria-label="Quitar fila {i + 1}">×</button>
            </div>
          {/each}
        </div>
        <button class="btn-borde btn-chico" onclick={() => estado.estructura.filas.push({ material: '', medida: '', cortes: '', largoPieza: '6' })}>+ Fila</button>
        <div class="campos">{@render campo('Desperdicio (%)', estado.estructura, 'desperdicio')}</div>
      {:else if pestana === 'mano'}
        <div class="campos">
          {#if servicios.length}
            <label class="ancho">
              Servicio del catálogo (opcional)
              <select bind:value={estado.mano.servicio} onchange={elegirServicio}>
                <option value="">— escribir a mano —</option>
                {#each servicios as s}<option value={s.servicio}>{s.servicio} ({s.formaCobro}{s.precio !== null ? ' ' + colones(s.precio) : ''})</option>{/each}
              </select>
            </label>
          {/if}
          <label>
            Forma de cobro
            <select bind:value={estado.mano.forma}>
              {#each FORMAS_COBRO as f}<option>{f}</option>{/each}
            </select>
          </label>
          {#if estado.mano.forma !== 'Precio fijo'}{@render campo(UNIDAD_MANO[estado.mano.forma], estado.mano, 'cantidad')}{/if}
          {@render campo(estado.mano.forma === 'Precio fijo' ? 'Precio (₡)' : `Precio por ${UNIDAD_MANO[estado.mano.forma].toLowerCase().replace(/s$/, '')} (₡)`, estado.mano, 'precio')}
          {#if estado.mano.forma === 'Por hora' || estado.mano.forma === 'Por día'}{@render campo('Personas', estado.mano, 'personas')}{/if}
          {@render campo('Imprevistos (%)', estado.mano, 'imprevistos')}
        </div>
        {#if estado.mano.forma === 'Por m²'}{@render usarArea(estado.mano, 'cantidad')}{/if}
      {:else if pestana === 'conversion'}
        <div class="campos">{@render campo('Valor', estado.conversion, 'valor')}</div>
        <ul class="conversiones">
          {#each C.conversiones(n(estado.conversion.valor), r.metrosPorVara) as x}
            <li><span>{C.num(n(estado.conversion.valor))} {x.de}</span> = <strong>{x.valor.toLocaleString('en-US', { maximumFractionDigits: 4 })} {x.a}</strong></li>
          {/each}
        </ul>
      {/if}
    </div>

    {#if actual}
      <div class="resultado">
        <h2>Resultado</h2>
        <p class="renglon">«{actual.renglon}»</p>
        {#each actual.extras ?? [] as x}<p class="extra">{x.etiqueta}: <strong>{x.valor}</strong></p>{/each}
        {#if actual.monto !== undefined}<p class="monto">Monto: <strong>{colones(actual.monto)}</strong></p>{/if}

        {#if actual.materiales.length}
          <div class="envoltura-resultados">
          <table class="tabla resultados">
            <thead><tr><th>Material</th><th class="num">Pedir</th><th title="¿Agregar a la cotización?">Agregar</th></tr></thead>
            <tbody>
              {#each actual.materiales as m (m.material)}
                {@const precio = precioDe(m.material)}
                {@const calc = m.calculado ?? m.cantidad}
                {@const p = paso(calc, m.unidad)}
                <tr class:apagado={!m.agregar}>
                  <td>
                    {m.material} <span class="unidad">({m.unidad})</span>
                    {#if precio !== null && m.cantidad > 0}<small class="precio">{colones(precio)} c/u · {colones(precio * m.cantidad)}</small>{/if}
                  </td>
                  <td class="num">
                    <div class="pedir">
                      <button class="mas-menos" onclick={() => pedir(m.material, calc, m.cantidad - p)} disabled={m.cantidad <= 0} aria-label="Pedir menos {m.material}">−</button>
                      <input
                        value={C.num(m.cantidad).replace(/,/g, '')}
                        onchange={(e) => pedir(m.material, calc, aNumero(e.currentTarget.value) ?? calc)}
                        inputmode="decimal"
                        aria-label="Cantidad a pedir de {m.material}"
                      />
                      <button class="mas-menos" onclick={() => pedir(m.material, calc, m.cantidad + p)} aria-label="Pedir más {m.material}">+</button>
                    </div>
                    {#if m.cantidad !== calc}
                      <small class="calculado">
                        calculado: {C.num(calc)} · {m.cantidad > calc ? '+' : '−'}{C.num(Math.abs(redondo(m.cantidad - calc)))}
                        <button class="enlace" onclick={() => pedir(m.material, calc, calc)}>volver</button>
                      </small>
                    {/if}
                  </td>
                  <td><input type="checkbox" checked={m.agregar} disabled={m.cantidad <= 0} onchange={(e) => marcar(m.material, e.currentTarget.checked)} aria-label="Agregar {m.material}" /></td>
                </tr>
              {/each}
            </tbody>
          </table>
          </div>
        {/if}

        <div class="acciones pie">
          <button class="btn-dorado" onclick={agregar}>Agregar a la cotización</button>
          <button class="btn-borde" onclick={limpiar}>Limpiar calculadora</button>
        </div>
      </div>
    {:else if pestana === 'conversion'}
      <div class="resultado">
        <p class="ayuda">Las conversiones son solo de consulta: no se agregan a la cotización.</p>
        <button class="btn-borde" onclick={limpiar}>Limpiar calculadora</button>
      </div>
    {/if}
  </section>
{/if}

<datalist id="calc-materiales">
  {#each catalogo as m}<option value={m.material}></option>{/each}
</datalist>

<DialogoAgregar bind:resultado={paraAgregar} />

<style>
  .destino {
    color: var(--suave);
    margin: 0 0 12px;
  }
  .pestanas {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 6px;
    margin-bottom: 12px;
    scrollbar-width: thin;
  }
  .pestanas button {
    flex: 0 0 auto;
    background: var(--blanco);
    border: 1px solid var(--linea);
    font-weight: 500;
    padding: 7px 14px;
    min-height: 38px;
    border-radius: 999px;
  }
  .pestanas button.activa {
    background: var(--carbon);
    color: var(--dorado-claro);
    border-color: var(--carbon);
    font-weight: 700;
  }
  .calc {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 24px;
    container-type: inline-size;
  }
  h3 {
    font-size: 0.95rem;
    margin: 14px 0 6px;
  }
  .filas {
    display: grid;
    gap: 6px;
  }
  .fila {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr 34px;
    gap: 6px;
    align-items: center;
  }
  .fila.pisos {
    grid-template-columns: 2fr 1fr 1fr 34px;
  }
  .fila input {
    margin: 0;
    min-width: 0;
  }
  .filas + :global(.btn-chico) {
    margin-top: 8px;
  }
  .quitar {
    background: transparent;
    border: none;
    color: var(--suave);
    font-size: 1.3rem;
    padding: 0;
    min-height: 38px;
  }
  .quitar:hover {
    color: var(--rojo);
  }
  .fila.cabeza {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--suave);
  }
  .totales {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin-top: 12px;
    padding: 10px;
    background: var(--fondo);
    border-radius: 8px;
  }
  .casilla {
    display: flex;
    gap: 8px;
    align-items: center;
    color: var(--texto);
    align-self: end;
    min-height: 42px;
    cursor: pointer;
  }
  .enlace {
    background: none;
    border: none;
    padding: 6px 0;
    min-height: 0;
    color: var(--dorado-osc);
    text-decoration: underline;
    font-weight: 600;
    font-size: 0.9rem;
  }
  .resultado {
    background: var(--fondo);
    border-radius: 10px;
    padding: 16px;
    align-self: start;
  }
  .renglon {
    font-style: italic;
    font-size: 1.05rem;
    margin: 0 0 8px;
  }
  .extra,
  .monto {
    margin: 4px 0;
    color: var(--suave);
  }
  .monto strong {
    color: var(--texto);
    font-size: 1.2rem;
  }
  .resultados {
    margin-top: 10px;
    background: var(--blanco);
  }
  .resultados td,
  .resultados th {
    padding: 6px 5px;
  }
  .resultados td:first-child {
    font-size: 0.88rem;
  }
  .envoltura-resultados {
    overflow-x: auto;
    max-width: 100%;
  }
  .linea-total {
    flex-basis: 100%;
  }
  .usar-area {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
    margin-top: 8px;
    font-size: 0.85rem;
    color: var(--suave);
  }
  .usar-caras {
    display: grid;
    gap: 4px;
    margin-top: 10px;
    font-size: 0.9rem;
  }
  .usar-caras > div {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
  .usar-caras .usar-area {
    margin-top: 0;
  }
  .huecos {
    grid-column: 1 / -1;
  }
  .huecos .acciones {
    margin-top: 6px;
  }
  .fila.con-tipo {
    grid-template-columns: 1.6fr 0.9fr 0.9fr 0.9fr 0.7fr 34px;
  }
  .fila select {
    margin: 0;
    min-width: 0;
  }
  .pedir {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .pedir input {
    width: 54px;
    min-width: 0 !important;
    min-height: 34px;
    margin: 0;
    padding: 4px 6px;
    text-align: right;
  }
  .mas-menos {
    min-height: 34px;
    width: 30px;
    flex: 0 0 auto;
    padding: 0;
    border-radius: 8px;
    background: var(--blanco);
    border: 1px solid var(--linea);
    font-size: 1.1rem;
    font-weight: 700;
  }
  .mas-menos:hover:not(:disabled) {
    border-color: var(--dorado);
  }
  .unidad {
    min-width: 0;
    text-align: left;
    font-size: 0.85rem;
    color: var(--suave);
  }
  .calculado {
    display: block;
    color: #8a6400;
    font-size: 0.78rem;
    margin-top: 2px;
  }
  .calculado .enlace {
    font-size: 0.78rem;
    padding: 0 0 0 4px;
  }
  .medir {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 12px;
    font-size: 0.9rem;
    color: var(--suave);
  }
  .medir label {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    border: 1px solid var(--linea);
    border-radius: 999px;
    padding: 5px 12px;
    cursor: pointer;
    color: var(--texto);
    font-weight: 500;
  }
  .medir label.activo {
    background: var(--carbon);
    color: var(--dorado-claro);
    border-color: var(--carbon);
  }
  .medir input {
    width: auto;
    min-height: 0;
    margin: 0;
  }
  .caras {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin: 12px 0;
  }
  .cara {
    border: 1px solid var(--linea);
    border-radius: 8px;
    padding: 8px 12px 10px;
    margin: 0;
    display: grid;
    gap: 6px;
  }
  .cara.apagada {
    opacity: 0.6;
  }
  .cara legend {
    padding: 0 4px;
  }
  .cara .ayuda {
    margin: 0;
  }
  @media (max-width: 560px) {
    .caras {
      grid-template-columns: 1fr;
    }
  }
  .precio {
    display: block;
    color: var(--suave);
  }
  tr.apagado td {
    color: #a29a8c;
  }
  .pie {
    margin-top: 14px;
  }
  .conversiones {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 6px;
    margin-top: 12px;
  }
  .conversiones li {
    background: var(--fondo);
    padding: 8px 10px;
    border-radius: 6px;
  }
  @media (max-width: 1000px) {
    .calc {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 560px) {
    .fila {
      grid-template-columns: 1fr 1fr 1fr 34px;
    }
    .fila.pisos {
      grid-template-columns: 1fr 1fr 34px;
    }
    .fila.con-tipo {
      grid-template-columns: 1.2fr 1fr 1fr 0.8fr 34px;
    }
    .fila > input:first-child {
      grid-column: 1 / -1;
    }
    .fila.cabeza {
      display: none;
    }
  }
</style>
