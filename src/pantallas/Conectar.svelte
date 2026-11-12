<script lang="ts">
  import { CONEXION_PRUEBA, MODO_PRUEBA_DISPONIBLE, conexionGuardada, esPrueba, guardarConexion, olvidarConexion } from '../lib/conexion.ts';
  import { datos } from '../lib/datos.svelte.ts';
  import { RepoDatos, type Conexion } from '../lib/github.ts';
  import { sesion } from '../lib/sesion.svelte.ts';

  const previa = conexionGuardada();
  let owner = $state(previa && !esPrueba(previa) ? previa.owner : '');
  let repo = $state(previa && !esPrueba(previa) ? previa.repo : 'arce-nunez-datos');
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
      error = e instanceof Error ? e.message : String(e);
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
          Usuario de GitHub dueño de los datos
          <input bind:value={owner} autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ej. ajuanmejias73-hash" />
        </label>
        <label>
          Nombre del repositorio de datos
          <input bind:value={repo} autocomplete="off" autocapitalize="off" spellcheck="false" />
        </label>
        <label>
          Token de GitHub
          <input type="password" bind:value={token} autocomplete="off" spellcheck="false" placeholder="github_pat_…" />
        </label>
        <button class="btn-dorado" type="submit" disabled={probando}>{probando ? 'Conectando…' : 'Conectar'}</button>
      </form>

      {#if error}<p class="error" role="alert">{error}</p>{/if}

      <details>
        <summary>¿Cómo se saca el token?</summary>
        <ol>
          <li>Entrá a GitHub con la cuenta dueña de los datos.</li>
          <li>Foto de perfil → <strong>Settings</strong> → <strong>Developer settings</strong> → <strong>Personal access tokens</strong> → <strong>Fine-grained tokens</strong> → <strong>Generate new token</strong>.</li>
          <li>En <strong>Repository access</strong> escogé <strong>Only select repositories</strong> y marcá solo el repositorio de datos.</li>
          <li>En <strong>Permissions → Contents</strong> escogé <strong>Read and write</strong>.</li>
          <li>Ponele el vencimiento más largo que permita, tocá <strong>Generate token</strong>, copialo y pegalo aquí. Cuando venza, se saca otro igual.</li>
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
  .cargando {
    color: var(--suave);
  }
  .error {
    text-align: left;
  }
</style>
