<script lang="ts">
  import { CONEXION_PRUEBA, MODO_PRUEBA_DISPONIBLE, conexionGuardada, esPrueba, guardarConexion, olvidarConexion } from '../lib/conexion.ts';
  import { datos } from '../lib/datos.svelte.ts';
  import { ErrorGitHub, RepoDatos, type Conexion } from '../lib/github.ts';
  import { sesion } from '../lib/sesion.svelte.ts';

  // Dónde están los datos de Arce Nuñez (ya escritos: solo hay que pegar el token).
  const DUENO = 'ajuanmejias73-hash';
  const REPOSITORIO = 'arce-nunez-datos';

  const previa = conexionGuardada();
  let owner = $state(previa && !esPrueba(previa) ? previa.owner : DUENO);
  let repo = $state(previa && !esPrueba(previa) ? previa.repo : REPOSITORIO);
  let token = $state('');
  let probando = $state(false);
  let error = $state('');

  async function conectar(c: Conexion) {
    probando = true;
    error = '';
    try {
      const info = await new RepoDatos(c).probar();
      if (!info.privado && !esPrueba(c)) {
        error = 'Ese repositorio es PÚBLICO: cualquiera podría ver clientes, teléfonos y montos. Hacelo privado en GitHub (Settings → Danger zone → Change visibility) y volvé a intentar.';
        return;
      }
      guardarConexion(c);
      await datos.conectar(c);
      if (datos.estado === 'listo' && datos.c) {
        token = '';
        sesion.restaurar(datos.c.ajustes.usuarios);
      } else {
        error = datos.error;
      }
    } catch (e) {
      // El error más común: el token se creó sin acceso a este repositorio.
      if (e instanceof ErrorGitHub && e.estado === 404) {
        error = `Ese token no tiene permiso sobre «${c.repo}». Hacé uno nuevo: en "Repository access" marcá "Only select repositories" y escogé ${c.repo}; en "Permissions", Contents → "Read and write". (Abajo: "¿Cómo se saca el token?")`;
      } else {
        error = e instanceof Error ? e.message : String(e);
      }
    } finally {
      probando = false;
    }
  }

  function enviar(ev: SubmitEvent) {
    ev.preventDefault();
    const c: Conexion = { base: 'https://api.github.com', owner: owner.trim(), repo: repo.trim(), token: token.trim() };
    if (!c.owner || !c.repo || !c.token) {
      error = 'Llená los tres datos.';
      return;
    }
    conectar(c);
  }

  function reintentar() {
    const c = conexionGuardada();
    if (c) conectar(c);
  }

  function cambiar() {
    olvidarConexion();
    datos.desconectar();
    error = '';
  }
</script>

<main class="pantalla">
  <div class="caja tarjeta">
    <img class="logo" src="./icono.png" alt="" />
    <h1>ARCE NUÑEZ</h1>
    <p class="sub">Sistema de cotizaciones y contabilidad</p>

    {#if datos.estado === 'cargando'}
      <p class="cargando" role="status">Cargando los datos…</p>
    {:else if datos.estado === 'error'}
      <p class="error" role="alert">{datos.error}</p>
      <div class="acciones centro">
        <button class="btn" onclick={reintentar} disabled={probando}>Intentar de nuevo</button>
        <button class="btn-borde" onclick={cambiar}>Cambiar la conexión</button>
      </div>
    {:else}
      <h2>Conectar este dispositivo</h2>
      <p class="ayuda">
        Se hace <strong>una sola vez</strong> en cada compu o celular. Los datos están guardados en un repositorio privado de GitHub; el
        token es la llave para entrar a ellos.
      </p>

      <form onsubmit={enviar} class="formulario">
        <label>
          Token de GitHub
          <input type="password" bind:value={token} autocomplete="off" spellcheck="false" placeholder="Pegá aquí el token (github_pat_…)" />
        </label>
        <details class="avanzado">
          <summary>Avanzado: dónde están los datos</summary>
          <label>
            Usuario de GitHub dueño de los datos
            <input bind:value={owner} autocomplete="off" autocapitalize="off" spellcheck="false" />
          </label>
          <label>
            Nombre del repositorio de datos
            <input bind:value={repo} autocomplete="off" autocapitalize="off" spellcheck="false" />
          </label>
        </details>
        <button class="btn-dorado" type="submit" disabled={probando}>{probando ? 'Conectando…' : 'Conectar'}</button>
      </form>

      {#if error}<p class="error" role="alert">{error}</p>{/if}

      <details>
        <summary>¿Cómo se saca el token?</summary>
        <ol>
          <li>Abrí <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">github.com/settings/personal-access-tokens/new</a> con la cuenta dueña de los datos.</li>
          <li><strong>Token name:</strong> por ejemplo "Arce Nuñez - Pablo". <strong>Expiration:</strong> Custom, la fecha más lejana (hasta 1 año).</li>
          <li><strong>Repository access:</strong> marcá <strong>Only select repositories</strong> y escogé <strong>arce-nunez-datos</strong>.</li>
          <li><strong>Permissions:</strong> tocá <strong>+ Add permissions</strong>, escogé <strong>Contents</strong> y ponelo en <strong>Read and write</strong>.</li>
          <li>Tocá <strong>Generate token</strong> (dos veces), copiá el código <code>github_pat_…</code> y pegalo arriba. Cuando venza, se saca otro igual.</li>
        </ol>
        <p class="ayuda">No le pasés el token a nadie: quien lo tenga puede ver y cambiar los datos.</p>
      </details>

      {#if MODO_PRUEBA_DISPONIBLE}
        <hr />
        <button class="btn-borde ancho" onclick={() => conectar(CONEXION_PRUEBA)} disabled={probando}>
          Usar datos de prueba (solo en esta compu)
        </button>
      {/if}
    {/if}
  </div>
</main>

<style>
  .pantalla {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: 24px 16px;
    background: var(--carbon);
  }
  .caja {
    width: min(460px, 100%);
    text-align: center;
  }
  .logo {
    width: 64px;
    border-radius: 6px;
  }
  h1 {
    margin: 8px 0 0;
    letter-spacing: 0.08em;
  }
  .sub {
    color: var(--suave);
    margin: 4px 0 18px;
  }
  .formulario {
    display: grid;
    gap: 12px;
    text-align: left;
    margin-top: 14px;
  }
  .centro {
    justify-content: center;
    margin-top: 14px;
  }
  details {
    text-align: left;
    margin-top: 16px;
    font-size: 0.92rem;
  }
  summary {
    cursor: pointer;
    font-weight: 600;
    color: var(--dorado-osc);
  }
  ol {
    padding-left: 20px;
  }
  li {
    margin: 4px 0;
  }
  hr {
    border: none;
    border-top: 1px solid var(--linea);
    margin: 18px 0;
  }
  .ancho {
    width: 100%;
  }
  .avanzado {
    margin-top: 0;
    font-size: 0.9rem;
  }
  .avanzado summary {
    font-weight: 500;
    color: var(--suave);
  }
  .avanzado label {
    margin-top: 8px;
  }
  .cargando {
    color: var(--suave);
  }
  .error {
    text-align: left;
  }
</style>
