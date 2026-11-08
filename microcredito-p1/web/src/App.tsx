import { AprobacionPago } from './AprobacionPago';
import { useState, type ReactNode } from 'react';
import {
  Home, Users, ClipboardList, Wallet, BarChart3, Settings,
  Leaf, ArrowLeft, ChevronRight, Bell, UserRound,
  CheckCircle2, AlertTriangle, FileText, Menu,
  MessageCircle, RefreshCw
} from 'lucide-react';
import { api, corteDefault, query } from './api';
import { Chat } from './Chat';
type Vista =
  | 'Alta de cliente'
  | 'Solicitud de crédito'
  | 'Detalle del crédito'
  | 'Registro de pago'
  | 'Plan de amortización'
  | 'Detalle de la mora'
  | 'Comprobante de pago'
  | 'Bandeja del comité'
  | 'Confirmación de desembolso'
  | 'Tablero gerencial'
  | 'Cierre diario / mensual';
const movil: Vista[] = [
  'Alta de cliente',
  'Solicitud de crédito',
  'Detalle del crédito',
  'Detalle de la mora',
  'Registro de pago',
  'Plan de amortización',
  'Comprobante de pago'
];
const escritorio: Vista[] = [
  'Bandeja del comité',
  'Confirmación de desembolso',
  'Tablero gerencial',
  'Cierre diario / mensual'
];
function money(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v)
    ? new Intl.NumberFormat('es-GT', {
        style: 'currency',
        currency: 'GTQ'
      }).format(v)
    : '—';
}
function get(data: unknown, ...keys: string[]): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return undefined;
  }
  const obj = data as Record<string, unknown>;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }
  return undefined;
}
function cents(n: string): number {
  const input = n.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(input)) {
    throw Error('Ingrese un monto válido con máximo dos decimales.');
  }
  const [whole, dec = ''] = input.split('.');
  const value = BigInt(whole) * 100n + BigInt(dec.padEnd(2, '0'));
  if (value <= 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw Error('Monto demasiado grande.');
  }
  return Number(value);
}
function Field({
  label, value, onChange, type = 'text',
  placeholder, required = false
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="form-field">
      <span>{label}{required && ' *'}</span>
      <input
        className="field"
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}
function useRequest() {
  const [value, setValue] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function run(path: string, init?: RequestInit) {
    setBusy(true);
    setError('');
    setValue(null);
    try {
      const out = await api(path, init);
      setValue(out);
      return out;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { value, error, busy, run, setError };
}
function mostrarValor(valor: unknown): string {
  if (valor === null || valor === undefined) return '—';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}
function Feedback({ value, error }: {
  value: unknown;
  error: string;
}) {
  const filas = Array.isArray(value) ? value : null;
  const objeto = value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  const columnas = filas && filas.length > 0 &&
    filas.every(item =>
      item !== null &&
      typeof item === 'object' &&
      !Array.isArray(item)
    )
      ? Array.from(new Set(
          filas.flatMap(item => Object.keys(item as Record<string, unknown>))
        ))
      : [];
  return (
    <div aria-live="polite">
      {error && (
        <div role="alert" className="alert error">{error}</div>
      )}
      {value !== null && (
        <div className="response">
          <strong>Resultado de la consulta</strong>
          {filas && columnas.length > 0 ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {columnas.map(col => <th key={col}>{col}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((item, i) => (
                    <tr key={i}>
                      {columnas.map(col => (
                        <td key={col}>
                          {mostrarValor(
                            (item as Record<string, unknown>)[col]
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : objeto ? (
            <div className="table-scroll">
              <table>
                <tbody>
                  {Object.entries(objeto).map(([clave, dato]) => (
                    <tr key={clave}>
                      <th scope="row">{clave}</th>
                      <td>{mostrarValor(dato)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>{mostrarValor(value)}</p>
          )}
          <details>
            <summary>Ver respuesta JSON original</summary>
            <pre>{JSON.stringify(value, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
function Card({ title, subtitle, children }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="white-card">
      <h2>{title}</h2>
      {subtitle && <p className="muted">{subtitle}</p>}
      {children}
    </section>
  );
}
function Header({
  mobile = false,
  perfil = 'asesor'
}: {
  mobile?: boolean;
  perfil?: 'asesor' | 'gerencia';
}) {
  if (mobile) {
    return (
      <div className="mobile-brand">
        <Leaf size={17} fill="currentColor" />
        <strong>Crédito Vecino</strong>
      </div>
    );
  }
  return (
    <div className="content-header">
      <strong>Crédito Vecino</strong>
      <div className="head-right">
        <Bell size={18} aria-label="Notificaciones" />
        <details className="sgmc-account">
          <summary><UserRound size={17} /> {perfil === "asesor" ? "Asesor de crédito" : "Gerencia"}</summary>
          <div className="sgmc-account-info">
            <strong>Acceso de demostración</strong>
            <p>La gestión de usuarios y permisos estará disponible al integrar la autenticación del backend.</p>
          </div>
        </details>
      </div>
    </div>
  );
}
function Alta({
  onNext, cliente, setCliente, nombre, setNombre,
  dpi, setDpi, municipio, setMunicipio
}: {
  onNext: () => void;
  cliente: string;
  setCliente: (v: string) => void;
  nombre: string;
  setNombre: (v: string) => void;
  dpi: string;
  setDpi: (v: string) => void;
  municipio: string;
  setMunicipio: (v: string) => void;
}) {
  const r = useRequest();
  return (
    <Card title="Alta de cliente">
      <form
        className="form-stack"
        onSubmit={async e => {
          e.preventDefault();
          if (
            !cliente.trim() ||
            !nombre.trim() ||
            !municipio.trim()
          ) {
            r.setError('Complete todos los campos obligatorios.');
            return;
          }
          if (!(/^\d{13}$/.test(dpi.trim()) || dpi.trim() === 'DPI-FICT-009001')) {
            r.setError('Ingrese 13 dígitos o el DPI ficticio de OP-3.');
            return;
          }
          const result = await r.run('/clientes', {
            method: 'POST',
            body: JSON.stringify({
              id: cliente, nombre, dpi, municipio
            })
          });
          if (result !== null) onNext();
        }}
      >
        <Field label="ID de cliente" value={cliente}
          onChange={setCliente} required />
        <Field label="Nombre" value={nombre}
          onChange={setNombre} required />
        <Field label="DPI" value={dpi}
          onChange={setDpi} required />
        <Field label="Municipio / Dirección"
          value={municipio} onChange={setMunicipio} required />
        <button className="btn" disabled={r.busy}>
          {r.busy ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
      <Feedback value={r.value} error={r.error} />
    </Card>
  );
}
function Solicitud({
  onNext, cliente, nombre, credito, setCredito,
  asesor, setAsesor, monto, setMonto, tna, setTna,
  cuotas, setCuotas, onSimulado
}: {
  onNext: () => void;
  cliente: string;
  nombre: string;
  credito: string;
  setCredito: (v: string) => void;
  asesor: string;
  setAsesor: (v: string) => void;
  monto: string;
  setMonto: (v: string) => void;
  tna: string;
  setTna: (v: string) => void;
  cuotas: string;
  setCuotas: (v: string) => void;
  onSimulado: (d: unknown) => void;
}) {
  const r = useRequest();
  async function simular() {
    try {
      const numeroCuotas = Number(cuotas);
      const tasa = Number(tna);
      if (!cliente.trim()) {
        throw new Error('Debe indicar un cliente.');
      }
      if (!Number.isInteger(numeroCuotas) || numeroCuotas < 3 || numeroCuotas > 24) {
        throw new Error('El plazo permitido es de 3 a 24 meses.');
      }
      if (tna.trim() === '' || !Number.isFinite(tasa) || tasa < 0) {
        throw new Error('Ingrese una tasa anual válida.');
      }
      const montoValidado = cents(monto);
      if (montoValidado < 100000 || montoValidado > 2500000) {
        throw new Error(
          'El monto permitido es de Q1,000 a Q25,000.'
        );
      }
      const datos = {
        clienteId: cliente,
        creditoId: credito,
        asesorId: asesor,
        montoCentavos: montoValidado,
        tnaPorcentaje: tasa,
        numeroCuotas: numeroCuotas,
        fechaCorte: corteDefault
      };
      const result = await r.run('/creditos/simular', {
        method: 'POST',
        body: JSON.stringify(datos)
      });
      if (result !== null) onSimulado(result);
    } catch (e) {
      r.setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <Card title="Solicitud de crédito">
      <div className="two-col">
        <Field label="Monto solicitado (Q)" value={monto}
          onChange={setMonto} required />
        <Field label="Plazo (meses)" type="number"
          value={cuotas} onChange={setCuotas} required />
        <Field label="Crédito" value={credito}
          onChange={setCredito} />
        <Field label="Asesor" value={asesor}
          onChange={setAsesor} />
        <Field label="Tasa anual (%)" type="number"
          value={tna} onChange={setTna} />
      </div>
      <button className="btn full" disabled={r.busy}
        onClick={() => void simular()}>
        Simular plan
      </button>
      <div className="inline-note">
        <Wallet size={18} />
        <span>
          Cliente: {nombre || cliente}.
          Los resultados aparecerán al responder la API.
        </span>
      </div>
      <div className="button-row">
        <button className="btn outline" disabled={r.value === null} onClick={onNext}>
          Ver plan de amortización <ChevronRight size={16} />
        </button>
      </div>
      <Feedback value={r.value} error={r.error} />
    </Card>
  );
}
function Consulta({
  vista, defaultId
}: {
  vista: 'Detalle del crédito' | 'Plan de amortización'
    | 'Detalle de la mora';
  defaultId: string;
}) {
  const [id, setId] = useState(defaultId);
  const [cuota, setCuota] = useState('3');
  const [fecha, setFecha] = useState(corteDefault);
  const r = useRequest();
  const sub = vista === 'Detalle del crédito'
    ? ''
    : vista === 'Plan de amortización'
      ? '/plan-amortizacion' : '/mora';
  const records = Array.isArray(r.value)
    ? r.value
    : get(r.value, 'cuotas', 'filas', 'plan', 'items');
  return (
    <Card title={vista}>
      <div className="two-col">
        <Field label="ID del crédito" value={id}
          onChange={setId} />
        <Field label="Fecha de corte" type="date"
          value={fecha} onChange={setFecha} />
        {sub === '/mora' && (
          <Field label="Número de cuota" type="number"
            value={cuota} onChange={setCuota} />
        )}
      </div>
      <button className="btn" disabled={r.busy}
        onClick={() => void r.run(query(
          `/creditos/${encodeURIComponent(id)}${sub}`,
          {
            fechaCorte: fecha,
            ...(sub === '/mora' ? { cuota } : {})
          }
        ))}>
        {r.busy ? 'Consultando…' : 'Consultar'}
      </button>
      {r.value !== null && (
        <>
          {vista === 'Detalle del crédito' && (
            <div className="financial-card">
              <span>
                Crédito {String(get(r.value, 'creditoId', 'id') ?? id)}
              </span>
              <strong>
                Saldo: {get(r.value, 'saldoCentavos') !== undefined
                  ? money(Number(get(r.value, 'saldoCentavos')) / 100)
                  : 'Consultar resultado'}
              </strong>
              <p>
                Estado: {String(get(r.value, 'estado', 'status')
                  ?? 'No especificado')}
              </p>
            </div>
          )}
          {vista === 'Plan de amortización'
            && Array.isArray(records) && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {['No.', 'Fecha', 'Cuota',
                      'Interés', 'Capital', 'Saldo'].map(k => (
                      <th key={k}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((item, i) => (
                    <tr key={i}>
                      <td>
                        {String(get(item, 'numero', 'numeroCuota')
                          ?? i + 1)}
                      </td>
                      <td>
                        {String(get(item, 'fechaVencimiento', 'fecha')
                          ?? '—')}
                      </td>
                      {[
                        'cuotaCentavos', 'interesCentavos',
                        'capitalCentavos', 'saldoCentavos'
                      ].map(k => (
                        <td key={k}>
                          {get(item, k) !== undefined
                            ? money(Number(get(item, k)) / 100)
                            : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {vista === 'Detalle de la mora' && (
            <div className="alert warning">
              <AlertTriangle size={22} />
              <span>
                La mora se calcula con fecha de corte y política vigente.
                Consulta el desglose exacto del backend.
              </span>
            </div>
          )}
        </>
      )}
      <Feedback value={r.value} error={r.error} />
    </Card>
  );
}
function Pago({ onSuccess }: {
  onSuccess: (d: unknown) => void;
}) {
  const [id, setId] = useState('CV-2026-0043');
  const [cuota, setCuota] = useState('1');
  const [fecha, setFecha] = useState(corteDefault);
  const [monto, setMonto] = useState('');
  const [clave, setClave] = useState('');
  const [propuesta, setPropuesta] = useState<unknown>(null);
  const r = useRequest();
  async function revisar() {
    setPropuesta(null);
    const d = await r.run(query(
      `/creditos/${encodeURIComponent(id)}/pago-exacto`,
      { fechaCorte: fecha, cuota }
    ));
    setPropuesta(d);
  }
  async function confirmar() {
    if (!propuesta) return;
    let montoCentavos: number;
    try {
      montoCentavos = cents(monto);
    } catch (e) {
      r.setError(e instanceof Error ? e.message : String(e));
      return;
    }
    if (!window.confirm(
      `¿Autoriza registrar el pago de Q${monto} del crédito ${id}?`
      + ' Esta acción modifica la cartera.'
    )) return;
    const d = await r.run('/pagos', {
      method: 'POST',
      body: JSON.stringify({
        creditoId: id,
        cuota: Number(cuota),
        fechaCorte: fecha,
        montoCentavos,
        claveIdempotencia: clave
      })
    });
    if (d !== null) {
      setPropuesta(null);
      onSuccess(d);
    }
  }
  return (
    <Card title="Registro de pago">
      <div className="two-col">
        <Field label="Crédito" value={id} onChange={setId} />
        <Field label="Cuota" type="number"
          value={cuota} onChange={setCuota} />
        <Field label="Fecha de operación" type="date"
          value={fecha} onChange={setFecha} />
        <Field label="Monto (Q)" value={monto}
          onChange={setMonto} />
        <Field label="Clave de idempotencia"
          value={clave} onChange={setClave} />
      </div>
      <button className="btn full" disabled={r.busy}
        onClick={() => void revisar()}>
        Ver desglose de prelación
      </button>
      {propuesta !== null && (
        <div className="financial-card">
          <strong>Monto exigible y desglose</strong>
          <p className="muted">
            Verifica el resultado real de la API antes de registrar.
          </p>
          <pre>{JSON.stringify(propuesta, null, 2)}</pre>
        </div>
      )}
      <button className="btn full"
        disabled={r.busy || !propuesta || !clave || !monto}
        onClick={() => void confirmar()}>
        Registrar pago con aprobación
      </button>
      <Feedback value={r.value} error={r.error} />
    </Card>
  );
}
function Comprobante({ pago }: { pago: unknown }) {
  return (
    <Card title="Comprobante de pago">
      {pago ? (
        <>
          <div className="payment-success">
            <CheckCircle2 size={36} />
            <strong>¡Pago registrado!</strong>
            <span>La API confirmó la operación.</span>
          </div>
          <Feedback value={pago} error="" />
        </>
      ) : (
        <div className="empty-state">
          <FileText size={30} />
          <p>
            El comprobante aparecerá después de registrar un pago real.
          </p>
        </div>
      )}
    </Card>
  );
}
function Comite() {
  const r = useRequest();
  return (
    <Card title="Bandeja del comité"
      subtitle="Las solicitudes y estados se consultan desde el backend.">
      <div className="button-row">
        <button className="btn" disabled={r.busy}
          onClick={() => void r.run('/solicitudes')}>
          Consultar solicitudes <RefreshCw size={16} />
        </button>
      </div>
      <Feedback value={r.value} error={r.error} />
    </Card>
  );
}
function Desembolso({
  cliente, credito, asesor, monto, tna, cuotas, simulacion
}: {
  cliente: string;
  credito: string;
  asesor: string;
  monto: string;
  tna: string;
  cuotas: string;
  simulacion: unknown;
}) {
  const r = useRequest();
  async function ejecutar() {
    if (!simulacion || !window.confirm(
      '¿Confirmar desembolso? Esta acción modifica la cartera.'
    )) return;
    try {
      await r.run('/creditos/desembolsar', {
        method: 'POST',
        body: JSON.stringify({
          clienteId: cliente,
          creditoId: credito,
          asesorId: asesor,
          montoCentavos: cents(monto),
          tnaPorcentaje: Number(tna),
          numeroCuotas: Number(cuotas),
          fechaCorte: corteDefault
        })
      });
    } catch (e) {
      r.setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <Card title="Confirmación de desembolso">
      <div className="summary-box">
        <h3>Resumen de solicitud</h3>
        <p className="sgmc-demo-note">
          Los importes mostrados provienen del formulario.
          No representan un crédito aprobado ni desembolsado.
          El desembolso requiere confirmación del backend.
        </p>
        <div><span>Cliente</span><strong>{cliente}</strong></div>
        <div><span>Monto</span><strong>{money(Number(monto))}</strong></div>
        <div><span>Plazo</span><strong>{cuotas} meses</strong></div>
        <div><span>Tasa de interés</span><strong>{tna}% TNA</strong></div>
        <div>
          <span>Simulación</span>
          <strong>{simulacion ? 'Disponible' : 'Pendiente'}</strong>
        </div>
      </div>
      <button className="btn"
        onClick={() => void ejecutar()}
        disabled={!simulacion || r.busy}>
        Confirmar desembolso
      </button>
      <Feedback value={r.value} error={r.error} />
    </Card>
  );
}
function Gerencia({ cierre = false }: { cierre?: boolean }) {
  const [fecha, setFecha] = useState(corteDefault);
  const [tipo, setTipo] = useState<'diario' | 'mensual'>('mensual');
  const r = useRequest();
  return (
    <Card title={cierre ? 'Cierre diario / mensual' : 'Tablero gerencial'}>
      <div className="form-bar">
        <Field label="Fecha de corte" type="date"
          value={fecha} onChange={setFecha} />
        {cierre && (
          <label className="form-field">
            <span>Tipo de cierre</span>
            <select className="field" value={tipo}
              onChange={e => setTipo(
                e.target.value as 'diario' | 'mensual'
              )}>
              <option value="diario">Diario</option>
              <option value="mensual">Mensual</option>
            </select>
          </label>
        )}
        <button className="btn" disabled={r.busy}
          onClick={() => void r.run(query(
            cierre ? `/cierres/${tipo}` : '/cartera/resumen',
            { fechaCorte: fecha }
          ))}>
          {r.busy ? 'Consultando…' : 'Consultar'}
        </button>
      </div>
      {cierre ? (
        <div className="metric-grid">
          <div className="metric sgmc-recovery">
            <strong>Recuperaciones por concepto</strong>
            {([
              ['Gastos', 'gastosCentavos'],
              ['Interés moratorio', 'interesMoratorioCentavos'],
              ['Interés corriente', 'interesCorrienteCentavos'],
              ['Capital', 'capitalCentavos']
            ] as const).map(([nombre, clave]) => {
              const detalle = get(
                r.value,
                'recuperacionesPorConcepto',
                'desgloseRecuperaciones'
              );
              const valor = get(detalle ?? r.value, clave);
              return (
                <div key={clave} className="sgmc-recovery-row">
                  <span>{nombre}</span>
                  <strong>
                    {valor !== undefined
                      ? money(Number(valor) / 100)
                      : '—'}
                  </strong>
                </div>
              );
            })}
          </div>
          <div className="metric">
            <Wallet />
            <span>Desembolsos</span>
            <strong>
              {get(r.value, 'desembolsosCentavos') !== undefined
                ? money(Number(get(r.value, 'desembolsosCentavos')) / 100)
                : '—'}
            </strong>
          </div>
          <div className="metric">
            <RefreshCw />
            <span>Recuperaciones</span>
            <strong>
              {get(r.value, 'recuperacionesCentavos') !== undefined
                ? money(Number(get(r.value, 'recuperacionesCentavos')) / 100)
                : '—'}
            </strong>
          </div>
          <div className="metric">
            <BarChart3 />
            <span>Saldo de cartera</span>
            <strong>
              {get(r.value, 'saldoCarteraCentavos') !== undefined
                ? money(Number(get(r.value, 'saldoCarteraCentavos')) / 100)
                : '—'}
            </strong>
          </div>
        </div>
      ) : (
        <div className="dashboard-grid">
          <div className="metric">
            <Wallet />
            <span>Cartera activa</span>
            <strong>
              {get(r.value, 'carteraActivaCentavos',
                'saldoCarteraActivaCentavos') !== undefined
                ? money(Number(get(r.value,
                    'carteraActivaCentavos',
                    'saldoCarteraActivaCentavos')) / 100)
                : '—'}
            </strong>
          </div>
          <div className="risk">
            <div className="tile-title">
              <AlertTriangle />
              <span>Cartera en riesgo</span>
            </div>
            <strong>
              {get(r.value, 'porcentajeRiesgo') !== undefined
                ? String(get(r.value, 'porcentajeRiesgo')) + '%'
                : '—'}
            </strong>
            <p>Desglose por tramo disponible al consultar la API.</p>
          </div>
          <div className="arrears">
            <div className="tile-title">
              <AlertTriangle />
              <span>Cartera en mora</span>
            </div>
            <strong>
              {get(r.value, 'porcentajeMora') !== undefined
                ? String(get(r.value, 'porcentajeMora')) + '%'
                : '—'}
            </strong>
            <p>Todo atraso a partir de un día.</p>
            <BarChart3 size={64} />
          </div>
        </div>
      )}
      <Feedback value={r.value} error={r.error} />
    </Card>
  );
}
export default function App() {
  const [vista, setVista] = useState<Vista>('Alta de cliente');
  const [perfil, setPerfil] = useState<'asesor' | 'gerencia'>('asesor');
  const [chatOpen, setChatOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  function alternarChat() {
    const abrir = !chatOpen;
    setChatOpen(abrir);
    setMenuOpen(false);
    if (abrir) {
      window.setTimeout(() => {
        document.querySelector('.chat-wrapper')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 80);
    }
  }
  const [cliente, setCliente] = useState('CL-9001');
  const [nombre, setNombre] = useState('');
  const [dpi, setDpi] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [credito, setCredito] = useState('CV-2026-9001');
  const [asesor, setAsesor] = useState('AS-01');
  const [monto, setMonto] = useState('10000');
  const [tna, setTna] = useState('36');
  const [cuotas, setCuotas] = useState('12');
  const [simulacion, setSimulacion] = useState<unknown>(null);
  const [pago, setPago] = useState<unknown>(null);
  function cambiarPerfil(nuevo: 'asesor' | 'gerencia') {
    setPerfil(nuevo);
    setMenuOpen(false);
    setChatOpen(false);
    setVista(nuevo === 'asesor'
      ? 'Alta de cliente'
      : 'Tablero gerencial');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function mostrar(v: Vista) {
    setMenuOpen(false);
    setVista(v);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function contenido() {
    switch (vista) {
      case 'Alta de cliente':
        return (
          <Alta
            onNext={() => mostrar('Solicitud de crédito')}
            {...{
              cliente, setCliente, nombre, setNombre,
              dpi, setDpi, municipio, setMunicipio
            }}
          />
        );
      case 'Solicitud de crédito':
        return (
          <Solicitud
            onNext={() => mostrar('Plan de amortización')}
            {...{
              cliente, nombre, credito, setCredito,
              asesor, setAsesor, monto, setMonto,
              tna, setTna, cuotas, setCuotas
            }}
            onSimulado={setSimulacion}
          />
        );
      case 'Detalle del crédito':
      case 'Plan de amortización':
      case 'Detalle de la mora':
        return <Consulta key={vista} vista={vista} defaultId={credito} />;
      case 'Registro de pago':
        return <Pago onSuccess={d => {
          setPago(d);
          mostrar('Comprobante de pago');
        }} />;
      case 'Comprobante de pago':
        return <Comprobante pago={pago} />;
      case 'Bandeja del comité':
        return <Comite />;
      case 'Confirmación de desembolso':
        return (
          <Desembolso
            {...{
              cliente, credito, asesor, monto,
              tna, cuotas, simulacion
            }}
          />
        );
      case 'Tablero gerencial':
        return <Gerencia />;
      case 'Cierre diario / mensual':
        return <Gerencia cierre />;
    }
  }
  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <div className="side-logo">
          <Leaf fill="currentColor" />
          Crédito Vecino
        </div>
        <nav aria-label="Navegación principal">
          {(perfil === 'asesor' ? movil : escritorio).map(v => (
            <button
              key={v}
              className={vista === v ? 'active' : ''}
              onClick={() => mostrar(v)}>
              <ClipboardList size={18} />
              {v}
            </button>
          ))}
          <button onClick={alternarChat}>
            <MessageCircle size={18} />
            Asistente IA
          </button>
        </nav>
        <div className="side-bottom">
          <UserRound />
          {perfil === 'asesor'
            ? 'Asesor de crédito'
            : 'Comité / Gerencia'}
        </div>
      </aside>
      <div className="app-main">
        <Header perfil={perfil} />
        <div className="mobile-only"><Header mobile /></div>
        <div className="screen-tabs" aria-label="Vistas del prototipo">
          <div className="tabs-group">
            <span>
              {perfil === 'asesor' ? 'OPERACIONES' : 'GERENCIA'}
            </span>
            {(perfil === 'asesor' ? movil : escritorio).map(v => (
              <button
                key={v}
                className={vista === v ? 'active' : ''}
                onClick={() => mostrar(v)}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="workspace">
          <div className="sgmc-profile-bar">
            <label>
              Perfil de demostración
              <select
                value={perfil}
                onChange={e => cambiarPerfil(
                  e.target.value as 'asesor' | 'gerencia'
                )}>
                <option value="asesor">Asesor de crédito</option>
                <option value="gerencia">Gerencia / Comité</option>
              </select>
            </label>
            <small>
              Selector de demostración, sin autenticación real.
            </small>
          </div>
          <div className="workspace-head">
            <button className="back-button"
              onClick={() => mostrar('Alta de cliente')}
              aria-label="Volver al inicio">
              <ArrowLeft size={19} />
            </button>
            <span>{vista}</span>
            <button className="chat-switch"
              onClick={alternarChat}>
              <MessageCircle size={18} />
              {chatOpen ? 'Ocultar chat' : 'Asistente IA'}
            </button>
          </div>
          {contenido()}
          {chatOpen && (
            <div className="chat-wrapper">
              <Chat />
              <details className="sgmc-payment-details">
                <summary>Operaciones financieras — pendientes de integración</summary>
                <p className="muted">
                  Los pagos y aprobaciones continúan deshabilitados
                  hasta validar los permisos del backend.
                </p>
                <AprobacionPago />
              </details>
            </div>
          )}
        </div>
        <nav className="mobile-bottom"
          aria-label="Navegación móvil por perfil">
          {perfil === 'asesor' ? (
            <>
              <button onClick={() => mostrar('Alta de cliente')}>
                <Home /> Inicio
              </button>
              <button onClick={() => mostrar('Solicitud de crédito')}>
                <ClipboardList /> Solicitud
              </button>
              <button onClick={() => mostrar('Detalle del crédito')}>
                <Wallet /> Créditos
              </button>
            </>
          ) : (
            <>
              <button onClick={() => mostrar('Tablero gerencial')}>
                <Home /> Tablero
              </button>
              <button onClick={() => mostrar('Bandeja del comité')}>
                <ClipboardList /> Comité
              </button>
              <button onClick={() => mostrar('Cierre diario / mensual')}>
                <BarChart3 /> Cierres
              </button>
            </>
          )}
          <button
            aria-expanded={menuOpen}
            aria-controls="sgmc-mobile-menu"
            onClick={() => setMenuOpen(v => !v)}>
            <Menu /> Más
          </button>
        </nav>
        {menuOpen && (
          <div id="sgmc-mobile-menu"
            className="sgmc-mobile-menu"
            role="navigation"
            aria-label="Todas las secciones">
            <div className="sgmc-menu-heading">
              <strong>Ir a una sección</strong>
              <button type="button"
                onClick={() => setMenuOpen(false)}>
                Cerrar
              </button>
            </div>
            {(perfil === 'asesor' ? movil : escritorio).map(v => (
              <button key={v} type="button"
                className={vista === v ? 'active' : ''}
                onClick={() => mostrar(v)}>
                {v}
              </button>
            ))}
            <button type="button" onClick={alternarChat}>
              <MessageCircle size={17} /> Asistente IA
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

