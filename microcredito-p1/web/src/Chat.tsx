import {
  useEffect, useRef, useState,
  type FormEvent
} from 'react';
import {
  Bot, UserRound, Send, Download,
  Trash2, MessageCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
type Mensaje = {
  id: number;
  autor: 'usuario' | 'asistente';
  texto: string;
  fuentes?: string[];
  error?: boolean;
};
const URL_IA =
  import.meta.env.VITE_IA_URL ?? 'http://localhost:3100';
const sugerencias = [
  '¿Qué consultas puedes realizar sobre créditos y cartera?',
  '¿Qué información necesitas para consultar la mora?',
  '¿Qué políticas de crédito puedes consultar?'
];
export function Chat() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [pregunta, setPregunta] = useState('');
  const [fechaCorte, setFechaCorte] =
    useState('2026-10-31');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const panel = useRef<HTMLDivElement>(null);
  const siguienteId = useRef(1);
  useEffect(() => {
    const el = panel.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [mensajes, enviando]);
  function agregar(
    autor: Mensaje['autor'],
    texto: string,
    fuentes?: string[],
    fallo = false
  ) {
    const id = siguienteId.current++;
    setMensajes(actual => [
      ...actual,
      { id, autor, texto, fuentes, error: fallo }
    ]);
  }
  async function enviar(textoIngresado?: string) {
    const texto = (textoIngresado ?? pregunta).trim();
    if (!texto || enviando) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaCorte)) {
      setError('Selecciona una fecha de corte válida.');
      return;
    }
    setError('');
    setPregunta('');
    agregar('usuario', texto);
    setEnviando(true);
    try {
      const respuesta = await fetch(`${URL_IA}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pregunta: texto,
          fechaCorte
        })
      });
      const cuerpo: unknown = await respuesta.json();
      const datos = (
        cuerpo && typeof cuerpo === 'object'
          ? cuerpo as Record<string, unknown>
          : {}
      );
      if (!respuesta.ok) {
        const detalle = datos.error ?? datos.mensaje;
        throw new Error(
          typeof detalle === 'string'
            ? detalle
            : `La consulta respondió HTTP ${respuesta.status}`
        );
      }
      const contenido =
        datos.respuesta ?? datos.mensaje ?? datos.resultado;
      const respuestaTexto =
        typeof contenido === 'string'
          ? contenido
          : contenido !== undefined
            ? JSON.stringify(contenido, null, 2)
            : 'La consulta no devolvió una respuesta.';
      const fuentes = Array.isArray(datos.fuentes)
        ? datos.fuentes.map(f =>
            typeof f === 'string'
              ? f
              : JSON.stringify(f)
          )
        : [];
      agregar('asistente', respuestaTexto, fuentes);
    } catch (e) {
      agregar(
        'asistente',
        e instanceof Error
          ? `No se pudo completar la consulta: ${e.message}`
          : 'No se pudo completar la consulta.',
        [],
        true
      );
    } finally {
      setEnviando(false);
    }
  }
  function enviarFormulario(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void enviar();
  }
  function exportar() {
    if (mensajes.length === 0) return;
    const contenido = [
      'Conversación — Crédito Vecino SGMC',
      'Fecha de corte: ' + fechaCorte,
      '',
      ...mensajes.map(m =>
        `${m.autor === 'usuario' ? 'Usuario' : 'Asistente'}:\n${m.texto}\n` +
        (m.fuentes?.length
          ? `Fuentes: ${m.fuentes.join('; ')}\n`
          : '')
      )
    ].join('\n');
    const blob = new Blob([contenido], {
      type: 'text/plain;charset=utf-8'
    });
    const enlace = document.createElement('a');
    const url = URL.createObjectURL(blob);
    enlace.href = url;
    enlace.download = 'SGMC-conversacion.txt';
    enlace.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="sgmc-chat white-card"
      aria-label="Asistente gerencial">
      <div className="sgmc-chat-heading">
        <div className="sgmc-chat-title">
          <MessageCircle size={22} />
          <div>
            <h2>Asistente gerencial</h2>
            <p>Consultas de crédito con información verificada</p>
          </div>
        </div>
        <div className="sgmc-chat-actions">
          <button type="button"
            title="Exportar conversación"
            aria-label="Exportar conversación"
            disabled={mensajes.length === 0}
            onClick={exportar}>
            <Download size={17} />
          </button>
          <button type="button"
            title="Limpiar conversación"
            aria-label="Limpiar conversación"
            disabled={mensajes.length === 0 || enviando}
            onClick={() => setMensajes([])}>
            <Trash2 size={17} />
          </button>
        </div>
      </div>
      <label className="sgmc-chat-date">
        Fecha de corte
        <input type="date"
          value={fechaCorte}
          onChange={e => setFechaCorte(e.target.value)} />
      </label>
      <div className="sgmc-chat-log"
        ref={panel}
        role="log"
        aria-label="Mensajes"
        aria-live="polite"
        aria-relevant="additions text">
        {mensajes.length === 0 && (
          <div className="sgmc-chat-welcome">
            <Bot size={30} />
            <strong>¿En qué puedo ayudarte?</strong>
            <p>
              Consulta información de créditos, mora,
              cartera y políticas del sistema.
            </p>
            <div className="sgmc-chat-suggestions">
              {sugerencias.map(s => (
                <button type="button" key={s}
                  disabled={enviando}
                  onClick={() => void enviar(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {mensajes.map(m => (
          <div key={m.id}
            className={'sgmc-chat-line ' +
              (m.autor === 'usuario' ? 'mine' : 'theirs')}>
            <div className="sgmc-chat-avatar">
              {m.autor === 'usuario'
                ? <UserRound size={16} />
                : <Bot size={16} />}
            </div>
            <div className={
              'sgmc-chat-bubble' + (m.error ? ' failure' : '')
            }>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {m.texto}
              </ReactMarkdown>
              {!!m.fuentes?.length && (
                <details className="sgmc-chat-sources">
                  <summary>Fuentes consultadas</summary>
                  <ul>
                    {m.fuentes.map((f, i) =>
                      <li key={i}>{f}</li>
                    )}
                  </ul>
                </details>
              )}
            </div>
          </div>
        ))}
        {enviando && (
          <div className="sgmc-chat-line theirs">
            <div className="sgmc-chat-avatar">
              <Bot size={16} />
            </div>
            <div className="sgmc-chat-bubble">
              Consultando información…
            </div>
          </div>
        )}
      </div>
      <form className="sgmc-chat-compose"
        onSubmit={enviarFormulario}>
        <textarea
          value={pregunta}
          rows={2}
          maxLength={2000}
          placeholder="Escribe tu pregunta…"
          aria-label="Mensaje para el asistente"
          disabled={enviando}
          onChange={e => setPregunta(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void enviar();
            }
          }}
        />
        <button className="btn"
          type="submit"
          disabled={enviando || !pregunta.trim()}
          aria-label="Enviar mensaje">
          <Send size={19} />
          <span>Enviar</span>
        </button>
      </form>
      {error && (
        <p role="alert" className="sgmc-chat-error">
          {error}
        </p>
      )}
      <p className="sgmc-chat-disclaimer">
        Las respuestas financieras dependen del backend.
        La IA no autoriza transacciones.
      </p>
    </section>
  );
}