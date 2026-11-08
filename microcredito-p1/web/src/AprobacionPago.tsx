import { useState } from 'react';
type Propuesta = {
  propuestaId: string;
  requiereAprobacion: boolean;
  estado: string;
  creditoId: string;
  cuota: number;
  fechaCorte: string;
  montoCentavos: number;
  desglose: unknown;
};
const URL_IA =
  import.meta.env.VITE_IA_URL ?? 'http://localhost:3100';
function centavos(valor: string): number {
  const texto = valor.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(texto)) {
    throw new Error('Ingrese un monto valido con maximo 2 decimales.');
  }
  const [entero, decimal = ''] = texto.split('.');
  const numero =
    BigInt(entero) * 100n + BigInt(decimal.padEnd(2, '0'));
  if (numero <= 0n || numero > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Monto fuera del rango permitido.');
  }
  return Number(numero);
}
async function enviar(
  ruta: string,
  datos: unknown
): Promise<unknown> {
  if (ruta === '/propuestas/pago' || ruta.startsWith('/aprobaciones/')) {
    throw new Error(
      'Propuestas y aprobaciones financieras deshabilitadas hasta validar la autorizacion del backend.'
    );
  }
  const respuesta = await fetch(`${URL_IA}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });
  const json: unknown = await respuesta.json();
  if (!respuesta.ok) {
    const mensaje =
      json && typeof json === 'object' && 'error' in json
        ? String(json.error)
        : `Error HTTP ${respuesta.status}`;
    throw new Error(mensaje);
  }
  return json;
}
export function AprobacionPago() {
  const [creditoId, setCreditoId] = useState('CV-2026-0043');
  const [cuota, setCuota] = useState('1');
  const [fechaCorte, setFechaCorte] = useState('2026-10-31');
  const [monto, setMonto] = useState('');
  const [clave, setClave] = useState('');
  const [propuesta, setPropuesta] = useState<Propuesta | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  function invalidar() {
    setPropuesta(null);
    setMensaje('');
  }
  async function proponer() {
    invalidar();
    setOcupado(true);
    try {
      const datos = await enviar('/propuestas/pago', {
        creditoId,
        cuota: Number(cuota),
        fechaCorte,
        montoCentavos: centavos(monto),
        claveIdempotencia: clave
      }) as Propuesta;
      if (!datos.propuestaId || datos.requiereAprobacion !== true) {
        throw new Error('La IA no devolvio una propuesta valida.');
      }
      setPropuesta(datos);
      setMensaje('Propuesta pendiente de aprobacion humana.');
    } catch (error) {
      setMensaje(
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setOcupado(false);
    }
  }
  async function decidir(aprobado: boolean) {
    if (!propuesta || ocupado) return;
    if (aprobado) {
      const confirmar = window.confirm(
        `¿Autoriza registrar el pago de Q${(
          propuesta.montoCentavos / 100
        ).toFixed(2)} del credito ${propuesta.creditoId}?`
      );
      if (!confirmar) return;
    }
    setOcupado(true);
    const id = propuesta.propuestaId;
    setPropuesta(null);
    try {
      const respuesta = await enviar(
        `/aprobaciones/${encodeURIComponent(id)}`,
        { aprobado }
      ) as { estado?: string; respuesta?: string };
      setMensaje(
        `${respuesta.estado ?? 'Respuesta'}: ${
          respuesta.respuesta ?? 'Operacion procesada.'
        }`
      );
    } catch (error) {
      setMensaje(
        'No se confirmo la operacion: ' +
        (error instanceof Error ? error.message : String(error)) +
        '. Verifique el estado antes de intentar otro pago.'
      );
    } finally {
      setOcupado(false);
    }
  }
  return (
    <section className="white-card" style={{ marginTop: 20 }}>
      <h2>Autorizacion humana de pagos</h2>
      <p className="muted">
        Primero se consulta el monto exacto en el backend.
        Ningun pago se registra sin una aprobacion explicita.
      </p>
      <div className="two-col">
        <label className="form-field">
          Credito
          <input className="field" value={creditoId}
            onChange={e => {
              invalidar();
              setCreditoId(e.target.value);
            }} />
        </label>
        <label className="form-field">
          Numero de cuota
          <input className="field" type="number" min="1"
            value={cuota} onChange={e => {
              invalidar();
              setCuota(e.target.value);
            }} />
        </label>
        <label className="form-field">
          Fecha de corte
          <input className="field" type="date"
            value={fechaCorte} onChange={e => {
              invalidar();
              setFechaCorte(e.target.value);
            }} />
        </label>
        <label className="form-field">
          Monto propuesto (Q)
          <input className="field" inputMode="decimal"
            value={monto} onChange={e => {
              invalidar();
              setMonto(e.target.value);
            }} />
        </label>
        <label className="form-field">
          Clave de idempotencia
          <input className="field" value={clave}
            placeholder="Ejemplo: SGMC-PAGO-OP1-001"
            onChange={e => {
              invalidar();
              setClave(e.target.value);
            }} />
        </label>
      </div>
      <button className="btn"
        disabled={ocupado || !clave.trim() || !monto.trim()}
        onClick={() => void proponer()}>
        {ocupado ? 'Procesando...' : 'Consultar y proponer pago'}
      </button>
      {propuesta && (
        <div className="financial-card" aria-live="polite">
          <strong>Propuesta pendiente</strong>
          <p>Credito: {propuesta.creditoId}</p>
          <p>Cuota: {propuesta.cuota}</p>
          <p>Fecha de corte: {propuesta.fechaCorte}</p>
          <p>
            Monto exacto: Q{(
              propuesta.montoCentavos / 100
            ).toFixed(2)}
          </p>
          <strong>Desglose del backend</strong>
          <pre>{JSON.stringify(propuesta.desglose, null, 2)}</pre>
          <div className="button-row">
            <button className="btn"
              disabled={ocupado}
              onClick={() => void decidir(true)}>
              Aprobar pago
            </button>
            <button className="btn outline"
              disabled={ocupado}
              onClick={() => void decidir(false)}>
              Rechazar
            </button>
          </div>
        </div>
      )}
      {mensaje && (
        <p role="status" aria-live="polite">{mensaje}</p>
      )}
    </section>
  );
}
