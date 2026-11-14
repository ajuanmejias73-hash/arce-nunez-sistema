<script lang="ts">
  import { conexionGuardada, esPrueba, olvidarConexion } from '../lib/conexion.ts';
  import { datos } from '../lib/datos.svelte.ts';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { aNumero } from '../lib/formato.ts';
  import { prepararImagen } from '../lib/imagenes.ts';
  import { crearRespaldo } from '../lib/respaldo.ts';
  import { descargar } from '../lib/exportar.svelte.ts';
  import { sesion } from '../lib/sesion.svelte.ts';
  import type { Ajustes, Clausula, CondicionClausula } from '../lib/tipos.ts';
  import Imagen from '../componentes/Imagen.svelte';

  const aj = () => $state.snapshot(datos.c!.ajustes) as Ajustes;
  const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

  // Copias locales de cada sección (se guardan por separado).
  let empresa = $state(aj().empresa);
  let usuarios = $state(aj().usuarios);
  let clausulas = $state(aj().clausulas);
  const d0 = aj().porDefecto;
  let def = $state({
    ...d0,
    adelantoPct: String(Math.round(d0.porcentajeAdelanto * 1000) / 10),
    ivaPct: String(Math.round(d0.iva * 1000) / 10),
    validez: String(d0.validezDias),
    garantia: String(d0.garantiaMeses),
  });

  let guardandoSeccion = $state('');
  let versionLogo = $state(0);
  const conexion = conexionGuardada();

  async function guardar(seccion: string, cambio: (a: Ajustes) => void, mensaje: string) {
    guardandoSeccion = seccion;
    try {
      await datos.modificar('ajustes', cambio, mensaje, sesion.quien);
      dialogos.avisar('Guardado');
      return true;
    } catch (e) {
      dialogos.fallo(e);
      return false;
    } finally {
      guardandoSeccion = '';
    }
  }

  // ---------- Empresa ----------
  const empresaCambio = $derived(!igual(empresa, datos.c!.ajustes.empresa));

  async function guardarEmpresa() {
    const copia = $state.snapshot(empresa);
    if (!copia.nombre.trim()) return dialogos.avisar('El nombre de la empresa no puede quedar vacío.', 'error');
    if (await guardar('empresa', (a) => void (a.empresa = copia), 'cambió los datos de la empresa')) empresa = aj().empresa;
  }

  async function cambiarLogo(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    guardandoSeccion = 'logo';
    try {
      const bytes = await prepararImagen(archivo, 600, 'image/png');
      const ruta = 'logo.png';
      await datos.subirArchivo(ruta, bytes, 'cambió el logo', sesion.quien);
      if (datos.c!.ajustes.empresa.logo !== ruta) {
        await datos.modificar('ajustes', (a) => void (a.empresa.logo = ruta), 'cambió el logo', sesion.quien);
        empresa.logo = ruta;
      }
      versionLogo++;
      dialogos.avisar('Logo cambiado');
    } catch (e) {
      dialogos.fallo(e);
    } finally {
      guardandoSeccion = '';
    }
  }

  // ---------- Valores por defecto ----------
  function defLimpio() {
    return {
      modoPrecio: def.modoPrecio,
      porcentajeAdelanto: (aNumero(def.adelantoPct) ?? NaN) / 100,
      iva: (aNumero(def.ivaPct) ?? NaN) / 100,
      validezDias: aNumero(def.validez) ?? NaN,
      garantiaMeses: aNumero(def.garantia) ?? NaN,
      horario: def.horario,
      quienCompraMateriales: def.quienCompraMateriales,
      prefijo: def.prefijo,
    };
  }
  const defCambio = $derived(!igual(defLimpio(), datos.c!.ajustes.porDefecto));

  async function guardarDefecto() {
    const n = defLimpio();
    if (!(n.porcentajeAdelanto >= 0 && n.porcentajeAdelanto <= 1)) return dialogos.avisar('El % de adelanto debe estar entre 0 y 100.', 'error');
    if (!(n.iva >= 0 && n.iva <= 1)) return dialogos.avisar('El % de IVA debe estar entre 0 y 100.', 'error');
    if (!(n.validezDias >= 0) || !Number.isInteger(n.validezDias)) return dialogos.avisar('La validez debe ser un número entero de días.', 'error');
    if (!(n.garantiaMeses >= 0)) return dialogos.avisar('La garantía debe ser un número de meses.', 'error');
    if (!n.prefijo.trim()) return dialogos.avisar('El prefijo del número no puede quedar vacío.', 'error');
    n.prefijo = n.prefijo.trim();
    await guardar('defecto', (a) => void (a.porDefecto = n), 'cambió los valores por defecto');
  }

  // ---------- Personas y PIN ----------
  const usuariosCambio = $derived(!igual(usuarios, datos.c!.ajustes.usuarios));

  async function guardarUsuarios() {
    const lista = $state.snapshot(usuarios).map((u) => ({ nombre: u.nombre.trim(), pin: u.pin.trim() }));
    if (lista.some((u) => !u.nombre)) return dialogos.avisar('Cada persona necesita un nombre.', 'error');
    if (lista.some((u) => !/^\d{4,8}$/.test(u.pin))) return dialogos.avisar('Cada PIN debe tener de 4 a 8 números.', 'error');
    if (new Set(lista.map((u) => u.pin)).size !== lista.length) return dialogos.avisar('Dos personas no pueden tener el mismo PIN.', 'error');
    if (new Set(lista.map((u) => u.nombre.toLowerCase())).size !== lista.length) return dialogos.avisar('Dos personas no pueden tener el mismo nombre.', 'error');
    // Si cambió el PIN de quien está usando el sistema, sigue adentro con su PIN nuevo.
    const yo = datos.c!.ajustes.usuarios.findIndex((u) => u.nombre === sesion.usuario);
    if (await guardar('usuarios', (a) => void (a.usuarios = lista), 'cambió personas y PIN')) {
      if (yo >= 0 && lista[yo]) sesion.entrar(lista[yo].pin, lista);
      usuarios = aj().usuarios;
    }
  }

  // ---------- Cláusulas ----------
  const clausulasCambio = $derived(!igual(clausulas, datos.c!.ajustes.clausulas));
  const CONDICIONES: { valor: CondicionClausula; nombre: string }[] = [
    { valor: '', nombre: 'Siempre el texto normal' },
    { valor: 'MATERIALES', nombre: 'MATERIALES: alternativo si Arce Nuñez compra' },
    { valor: 'IVA', nombre: 'IVA: alternativo si se cobra IVA' },
    { valor: 'PAGO', nombre: 'PAGO: usa la "Forma de pago especial" si hay' },
  ];
  const PALABRAS = ['{PARTES}', '{COBERTURA}', '{GARANTIA}', '{ADELANTO_PCT}', '{ADELANTO}', '{SALDO_PCT}', '{SALDO}', '{HORARIO}', '{PERSONAL}', '{VALIDEZ}', '{SINPE}', '{TITULAR}', '{IVA_PCT}'];

  function mover(i: number, paso: number) {
    const j = i + paso;
    if (j < 0 || j >= clausulas.length) return;
    [clausulas[i], clausulas[j]] = [clausulas[j], clausulas[i]];
  }

  async function quitarClausula(i: number) {
    const ok = await dialogos.confirmar(`¿Borrar la cláusula «${clausulas[i].titulo || 'sin título'}»?`, 'Se borra al tocar "Guardar cláusulas". Las cotizaciones ya guardadas no cambian.', { si: 'Borrar', peligro: true });
    if (ok) clausulas.splice(i, 1);
  }

  function nuevaClausula() {
    clausulas.push({ titulo: '', texto: '', alternativo: '', condicion: '' } satisfies Clausula);
  }

  async function guardarClausulas() {
    const lista = $state.snapshot(clausulas).filter((c) => c.titulo.trim() || c.texto.trim());
    if (await guardar('clausulas', (a) => void (a.clausulas = lista), 'cambió las cláusulas')) clausulas = aj().clausulas;
  }

  function deshacerClausulas() {
    clausulas = aj().clausulas;
  }

  // ---------- Conexión ----------
  // ---------- Respaldo ----------
  let respaldando = $state('');
  async function respaldo() {
    respaldando = 'Preparando…';
    try {
      const r = await crearRespaldo((t) => (respaldando = t));
      descargar(r.blob, r.nombre);
      dialogos.avisar(r.faltaron.length ? `Respaldo listo. No se encontraron ${r.faltaron.length} archivos (fotos o PDF que ya no existen).` : 'Respaldo listo');
    } catch (e) {
      dialogos.avisar('No se pudo hacer el respaldo: ' + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      respaldando = '';
    }
  }

  async function desconectar() {
    const ok = await dialogos.confirmar(
      '¿Desconectar este dispositivo?',
      'Se borra el token guardado en este navegador. Para volver a entrar hay que pegarlo otra vez. Los datos NO se borran.',
      { si: 'Desconectar', peligro: true },
    );
    if (!ok) return;
    olvidarConexion();
    sesion.salir();
    datos.desconectar();
  }
</script>

<h1>Ajustes</h1>

<!-- EMPRESA -->
<section class="tarjeta">
  <div class="tarjeta-titulo"><h2>Empresa</h2></div>
  <div class="logo-fila">
    <div class="logo-caja"><Imagen ruta={empresa.logo} alt="Logo actual" clase="logo-actual" version={versionLogo} /></div>
    <div>
      <label class="btn-borde subir">
        {guardandoSeccion === 'logo' ? 'Subiendo…' : 'Cambiar logo'}
        <input type="file" accept="image/*" class="oculto-visual" onchange={cambiarLogo} disabled={guardandoSeccion === 'logo'} />
      </label>
      <p class="ayuda">Sale en la cotización sobre fondo oscuro. Mejor si es PNG.</p>
    </div>
  </div>
  <div class="campos">
    <label>Nombre <input bind:value={empresa.nombre} /></label>
    <label>Lema <input bind:value={empresa.lema} /></label>
    <label>Teléfonos <input bind:value={empresa.telefonos} /></label>
    <label>Responsable / titular del SINPE <input bind:value={empresa.responsable} /></label>
    <label>SINPE Móvil <input bind:value={empresa.sinpe} inputmode="tel" /></label>
    <label>Correo (opcional) <input type="email" bind:value={empresa.correo} /></label>
    <label>Personal <input bind:value={empresa.personal} /></label>
    <label>Pie de página <input bind:value={empresa.pie} /></label>
  </div>
  <div class="acciones pie">
    <button class="btn" onclick={guardarEmpresa} disabled={!empresaCambio || !!guardandoSeccion}>
      {guardandoSeccion === 'empresa' ? 'Guardando…' : 'Guardar empresa'}
    </button>
  </div>
</section>

<!-- VALORES POR DEFECTO -->
<section class="tarjeta">
  <div class="tarjeta-titulo">
    <h2>Valores por defecto</h2>
    <span class="ayuda">Se usan al hacer una cotización nueva.</span>
  </div>
  <div class="campos">
    <label>% de adelanto <input bind:value={def.adelantoPct} inputmode="decimal" /></label>
    <label>% de IVA <input bind:value={def.ivaPct} inputmode="decimal" /></label>
    <label>Validez (días) <input bind:value={def.validez} inputmode="numeric" /></label>
    <label>Garantía (meses) <input bind:value={def.garantia} inputmode="numeric" /></label>
    <label>Horario de trabajo <input bind:value={def.horario} /></label>
    <label>
      ¿Quién compra los materiales?
      <select bind:value={def.quienCompraMateriales}>
        <option>El cliente</option>
        <option>Arce Nuñez</option>
      </select>
    </label>
    <label>Prefijo del número <input bind:value={def.prefijo} /></label>
  </div>
  <div class="acciones pie">
    <button class="btn" onclick={guardarDefecto} disabled={!defCambio || !!guardandoSeccion}>
      {guardandoSeccion === 'defecto' ? 'Guardando…' : 'Guardar valores'}
    </button>
  </div>
</section>

<!-- PERSONAS Y PIN -->
<section class="tarjeta">
  <div class="tarjeta-titulo">
    <h2>Personas y PIN</h2>
    <span class="ayuda">El PIN dice quién entró. Todo lo que se guarda queda con su nombre.</span>
  </div>
  {#each usuarios as u, i}
    <div class="campos persona">
      <label>Nombre <input bind:value={u.nombre} /></label>
      <label>PIN (4 a 8 números) <input bind:value={u.pin} inputmode="numeric" autocomplete="off" maxlength="8" /></label>
    </div>
    {#if i < usuarios.length - 1}<hr />{/if}
  {/each}
  <div class="acciones pie">
    <button class="btn" onclick={guardarUsuarios} disabled={!usuariosCambio || !!guardandoSeccion}>
      {guardandoSeccion === 'usuarios' ? 'Guardando…' : 'Guardar personas'}
    </button>
  </div>
</section>

<!-- CLÁUSULAS -->
<section class="tarjeta">
  <div class="tarjeta-titulo">
    <h2>Condiciones del contrato (cláusulas)</h2>
    <button class="btn-borde btn-chico" onclick={nuevaClausula}>+ Nueva cláusula</button>
  </div>
  <details class="palabras">
    <summary>Palabras automáticas que se pueden usar</summary>
    <p class="ayuda">Se cambian solas en cada cotización: {PALABRAS.join(' · ')}</p>
  </details>

  {#each clausulas as c, i}
    <div class="clausula">
      <div class="clausula-cabeza">
        <strong>{i + 1}. {c.titulo || 'Sin título'}</strong>
        <div class="acciones">
          <button class="btn-borde btn-chico" onclick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">↑</button>
          <button class="btn-borde btn-chico" onclick={() => mover(i, 1)} disabled={i === clausulas.length - 1} aria-label="Bajar">↓</button>
          <button class="btn-peligro btn-chico" onclick={() => quitarClausula(i)}>Borrar</button>
        </div>
      </div>
      <div class="campos">
        <label>Título <input bind:value={c.titulo} /></label>
        <label>
          Condición
          <select bind:value={c.condicion}>
            {#each CONDICIONES as op}<option value={op.valor}>{op.nombre}</option>{/each}
          </select>
        </label>
        <label class="ancho">Texto <textarea bind:value={c.texto} rows="3"></textarea></label>
        {#if c.condicion === 'MATERIALES' || c.condicion === 'IVA' || c.alternativo}
          <label class="ancho">Texto alternativo <textarea bind:value={c.alternativo} rows="2"></textarea></label>
        {/if}
      </div>
    </div>
  {:else}
    <p class="vacio">No hay cláusulas.</p>
  {/each}

  <div class="acciones pie">
    <button class="btn" onclick={guardarClausulas} disabled={!clausulasCambio || !!guardandoSeccion}>
      {guardandoSeccion === 'clausulas' ? 'Guardando…' : 'Guardar cláusulas'}
    </button>
    {#if clausulasCambio}<button class="btn-borde" onclick={deshacerClausulas}>Deshacer cambios</button>{/if}
  </div>
</section>

<!-- RESPALDO -->
<section class="tarjeta">
  <div class="tarjeta-titulo"><h2>Respaldo</h2></div>
  <p class="ayuda">Descarga todos los datos (cotizaciones, catálogos, contabilidad, fotos, PDF y logo) en un archivo .zip. Guardalo en un lugar seguro: tiene datos de clientes.</p>
  <button class="btn" onclick={respaldo} disabled={!!respaldando}>{respaldando || 'Descargar respaldo (.zip)'}</button>
</section>

<!-- CONEXIÓN -->
<section class="tarjeta">
  <div class="tarjeta-titulo"><h2>Conexión de este dispositivo</h2></div>
  <p>
    {#if esPrueba(conexion)}
      Usando los <strong>datos de prueba</strong> de esta compu.
    {:else}
      Conectado al repositorio privado <strong>{conexion?.owner}/{conexion?.repo}</strong>.
    {/if}
  </p>
  <button class="btn-peligro" onclick={desconectar}>Desconectar este dispositivo</button>
</section>

<style>
  .pie {
    margin-top: 16px;
  }
  .logo-fila {
    display: flex;
    gap: 16px;
    align-items: center;
    margin-bottom: 16px;
  }
  .logo-caja {
    background: var(--carbon);
    border-radius: 8px;
    padding: 8px;
    display: grid;
    place-items: center;
  }
  .logo-caja :global(.logo-actual) {
    width: 64px;
    height: 88px;
    object-fit: contain;
  }
  .subir {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--linea);
    border-radius: 8px;
    padding: 8px 14px;
    cursor: pointer;
    color: var(--texto);
    font-size: 1rem;
  }
  .subir:focus-within {
    outline: 2px solid var(--dorado);
  }
  .persona {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }
  hr {
    border: none;
    border-top: 1px solid var(--linea);
    margin: 14px 0;
  }
  .palabras {
    margin-bottom: 12px;
  }
  .palabras summary {
    cursor: pointer;
    color: var(--dorado-osc);
    font-weight: 600;
    font-size: 0.9rem;
  }
  .clausula {
    border: 1px solid var(--linea);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 10px;
    background: #fdfcf9;
  }
  .clausula-cabeza {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
</style>
