/** Avisos cortos ("Guardado") y preguntas de confirmación, para toda la página. */

export interface Aviso {
  id: number;
  texto: string;
  tipo: 'ok' | 'error';
}

interface Pregunta {
  titulo: string;
  texto: string;
  si: string;
  peligro: boolean;
  /** Texto del botón de cancelar. */
  no: string;
  /** Si pide escribir algo: lo escrito queda aquí. */
  campo: { valor: string; etiqueta: string } | null;
  responder: (v: boolean) => void;
}

class Dialogos {
  avisos = $state<Aviso[]>([]);
  pregunta = $state<Pregunta | null>(null);
  private siguiente = 1;

  avisar(texto: string, tipo: 'ok' | 'error' = 'ok'): void {
    const id = this.siguiente++;
    this.avisos.push({ id, texto, tipo });
    setTimeout(() => this.quitar(id), tipo === 'error' ? 8000 : 3000);
  }

  quitar(id: number): void {
    this.avisos = this.avisos.filter((a) => a.id !== id);
  }

  /** Muestra el error de un guardado fallido de forma entendible. */
  fallo(e: unknown): void {
    this.avisar('No se pudo guardar: ' + (e instanceof Error ? e.message : String(e)), 'error');
  }

  confirmar(titulo: string, texto = '', opciones: { si?: string; no?: string; peligro?: boolean } = {}): Promise<boolean> {
    this.pregunta?.responder(false);
    return new Promise((resolve) => {
      this.pregunta = {
        titulo,
        texto,
        si: opciones.si ?? 'Sí',
        no: opciones.no ?? 'Cancelar',
        peligro: opciones.peligro ?? false,
        campo: null,
        responder: (v) => {
          this.pregunta = null;
          resolve(v);
        },
      };
    });
  }

  /** Pide escribir un texto (puede quedar vacío). Devuelve null si se cancela. */
  pedirTexto(titulo: string, etiqueta: string, opciones: { si?: string; texto?: string } = {}): Promise<string | null> {
    this.pregunta?.responder(false);
    return new Promise((resolve) => {
      const p: Pregunta = $state({
        titulo,
        texto: opciones.texto ?? '',
        si: opciones.si ?? 'Aceptar',
        no: 'Cancelar',
        peligro: false,
        campo: { valor: '', etiqueta },
        responder: (v) => {
          this.pregunta = null;
          resolve(v ? p.campo!.valor.trim() : null);
        },
      });
      this.pregunta = p;
    });
  }
}

export const dialogos = new Dialogos();
