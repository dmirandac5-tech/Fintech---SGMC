/**
 * Raíz del agregado. Coordina las piezas del núcleo (plan, mora, prelación,
 * estado, mayor) sin duplicar sus reglas. No conoce persistencia ni red, y la
 * fecha de corte siempre llega como parámetro.
 */

import { Dinero } from './dinero';
import {
  calcularDiasAtraso,
  calcularInteresMoratorio,
  clasificarTramoMora,
  debeSuspenderDevengo,
  LIMITES_TRAMO,
  type TramoMora,
} from './calculadora-mora';
import {
  construirPlanAmortizacion,
  type EstrategiaAmortizacion,
  type PlanAmortizacion,
} from './plan-amortizacion';
import {
  politicaVigenteEn,
  tasaMensual,
  type PoliticaCredito,
} from './politica-credito';
import {
  aplicarPrelacion,
  montoAplicadoA,
  type AplicacionPago,
  type DeudaCuota,
} from './prelacion-pago';
import {
  saldoCapitalDesdeMovimientos,
  type Movimiento,
  type TipoMovimiento,
} from './movimiento';
import {
  SOLICITADO,
  TransicionInvalidaError,
  type EstadoCredito,
  type NombreEstadoCredito,
} from './estado-credito';

/** Pendiente de una cuota. El moratorio no se guarda: se calcula al corte. */
interface SaldoCuota {
  readonly numero: number;
  readonly fechaVencimiento: Date;
  gastosPendientes: Dinero;
  interesPendiente: Dinero;
  capitalPendiente: Dinero;
}

export interface CambioEstado {
  readonly desde: NombreEstadoCredito;
  readonly hacia: NombreEstadoCredito;
  readonly fecha: Date;
  readonly usuarioOProceso: string;
  readonly motivo: string;
}

export interface AplicacionPorCuota {
  readonly cuotaNumero: number;
  readonly diasAtraso: number;
  readonly aplicaciones: readonly AplicacionPago[];
}

export interface ReciboPago {
  readonly creditoId: string;
  readonly claveIdempotencia: string;
  readonly montoRecibido: Dinero;
  readonly porCuota: readonly AplicacionPorCuota[];
  readonly excedente: Dinero;
  readonly destinoExcedente: 'AMORTIZACION_CAPITAL' | 'CUOTAS_FUTURAS' | 'NINGUNO';
  readonly estadoAnterior: NombreEstadoCredito;
  readonly estadoNuevo: NombreEstadoCredito;
  readonly diasAtrasoAntes: number;
  readonly diasAtrasoDespues: number;
  readonly tramoAntes: TramoMora;
  readonly tramoDespues: TramoMora;
  /** true si se devolvió el recibo original por repetirse la clave. */
  readonly repetido: boolean;
}

export interface DatosSolicitud {
  readonly id: string;
  readonly clienteId: string;
  readonly montoSolicitado: Dinero;
  readonly plazoMeses: number;
  readonly fechaSolicitud: Date;
}

export interface DatosDesembolso {
  readonly fechaDesembolso: Date;
  readonly politicas: readonly PoliticaCredito[];
  readonly estrategia?: EstrategiaAmortizacion;
  readonly usuarioOProceso?: string;
}

export interface DatosPago {
  readonly monto: Dinero;
  readonly fechaCorte: Date;
  readonly claveIdempotencia: string;
  readonly gastosDelPeriodo?: Dinero;
}

export class Credito {
  private estado: EstadoCredito = SOLICITADO;
  private planInterno: PlanAmortizacion | null = null;
  private politicaInterna: PoliticaCredito | null = null;
  private fechaDesembolsoInterna: Date | null = null;
  private saldos: SaldoCuota[] = [];
  private readonly movimientos: Movimiento[] = [];
  private readonly historial: CambioEstado[] = [];
  private readonly recibosPorClave = new Map<string, ReciboPago>();
  private reestructurado = false;
  private suspenso = false;
  private saldoAFavor: Dinero;
  private contadorMovimientos = 0;

  private constructor(
    readonly id: string,
    readonly clienteId: string,
    readonly montoSolicitado: Dinero,
    readonly plazoMeses: number,
    readonly fechaSolicitud: Date,
  ) {
    this.saldoAFavor = Dinero.cero(montoSolicitado.codigoMoneda);
  }

  static solicitar(datos: DatosSolicitud): Credito {
    if (!Number.isInteger(datos.plazoMeses) || datos.plazoMeses < 3 || datos.plazoMeses > 24) {
      throw new Error(`El plazo debe estar entre 3 y 24 meses, se recibió ${datos.plazoMeses}`);
    }
    if (!datos.montoSolicitado.esPositivo()) {
      throw new Error('El monto solicitado debe ser positivo');
    }
    return new Credito(
      datos.id,
      datos.clienteId,
      datos.montoSolicitado,
      datos.plazoMeses,
      datos.fechaSolicitud,
    );
  }

  // --------------------------------------------------------------- consultas

  get estadoActual(): NombreEstadoCredito {
    return this.estado.nombre;
  }

  get esReestructurado(): boolean {
    return this.reestructurado;
  }

  get interesEnSuspenso(): boolean {
    return this.suspenso;
  }

  get plan(): PlanAmortizacion {
    if (this.planInterno === null) {
      throw new Error(`El crédito ${this.id} aún no tiene plan de amortización (no se ha desembolsado)`);
    }
    return this.planInterno;
  }

  get politica(): PoliticaCredito {
    if (this.politicaInterna === null) {
      throw new Error(`El crédito ${this.id} aún no tiene política asignada (no se ha desembolsado)`);
    }
    return this.politicaInterna;
  }

  get fechaDesembolso(): Date {
    if (this.fechaDesembolsoInterna === null) {
      throw new Error(`El crédito ${this.id} no se ha desembolsado`);
    }
    return new Date(this.fechaDesembolsoInterna.getTime());
  }

  librosDelMayor(): readonly Movimiento[] {
    return [...this.movimientos];
  }

  historialDeEstados(): readonly CambioEstado[] {
    return [...this.historial];
  }

  excedenteAFavor(): Dinero {
    return this.saldoAFavor;
  }

  saldoCapital(): Dinero {
    const moneda = this.montoSolicitado.codigoMoneda;
    return this.saldos.reduce(
      (total, cuota) => total.sumar(cuota.capitalPendiente),
      Dinero.cero(moneda),
    );
  }

  /** Días de atraso de la cuota impagada más antigua a la fecha de corte. */
  diasAtraso(fechaCorte: Date): number {
    return this.saldos
      .filter((cuota) => this.tieneDeudaPendiente(cuota))
      .reduce((maximo, cuota) => Math.max(maximo, calcularDiasAtraso(cuota.fechaVencimiento, fechaCorte)), 0);
  }

  tramoMora(fechaCorte: Date): TramoMora {
    return clasificarTramoMora(this.diasAtraso(fechaCorte));
  }

  private tieneDeudaPendiente(cuota: SaldoCuota): boolean {
    return (
      cuota.gastosPendientes.esPositivo() ||
      cuota.interesPendiente.esPositivo() ||
      cuota.capitalPendiente.esPositivo()
    );
  }

  private cuotasVencidasImpagas(fechaCorte: Date): SaldoCuota[] {
    return this.saldos
      .filter(
        (cuota) =>
          this.tieneDeudaPendiente(cuota) && cuota.fechaVencimiento.getTime() <= fechaCorte.getTime(),
      )
      .sort((a, b) => a.numero - b.numero);
  }

  // ------------------------------------------------------------ originación

  aprobar(fecha: Date, usuarioOProceso = 'comite'): void {
    this.transicionar(this.estado.aprobar(), fecha, usuarioOProceso, 'Cumple la política de crédito');
  }

  rechazar(fecha: Date, motivo = 'No cumple la política de crédito', usuarioOProceso = 'comite'): void {
    this.transicionar(this.estado.rechazar(), fecha, usuarioOProceso, motivo);
  }

  anular(fecha: Date, motivo = 'El cliente desiste antes del desembolso', usuarioOProceso = 'asesor'): void {
    this.transicionar(this.estado.anular(), fecha, usuarioOProceso, motivo);
  }

  /** Entrega el capital y arranca el plan con la política vigente ese día. */
  desembolsar(datos: DatosDesembolso): void {
    const { fechaDesembolso, politicas, estrategia, usuarioOProceso = 'asesor' } = datos;
    const politica = politicaVigenteEn(politicas, fechaDesembolso);

    this.transicionar(this.estado.desembolsar(), fechaDesembolso, usuarioOProceso, 'Capital entregado al cliente');

    this.politicaInterna = politica;
    this.fechaDesembolsoInterna = new Date(fechaDesembolso.getTime());
    this.planInterno = construirPlanAmortizacion({
      capital: this.montoSolicitado,
      tasaPeriodica: tasaMensual(politica),
      numeroCuotas: this.plazoMeses,
      fechaDesembolso,
      ...(estrategia === undefined ? {} : { estrategia }),
    });
    this.saldos = this.planInterno.cuotas.map((cuota) => ({
      numero: cuota.numero,
      fechaVencimiento: cuota.fechaVencimiento,
      gastosPendientes: Dinero.cero(this.montoSolicitado.codigoMoneda),
      interesPendiente: cuota.interes,
      capitalPendiente: cuota.amortizacion,
    }));

    this.asentar('DESEMBOLSO', this.montoSolicitado, fechaDesembolso, null, null);
    this.transicionar(this.estado.iniciarPlan(), fechaDesembolso, 'sistema', 'Inicia el plan de pagos');
  }

  // ------------------------------------------------------------------ pagos

  /**
   * Aplica la prelación de 6.6 cuota vencida por cuota vencida, de la más
   * antigua a la más reciente. Repetir la misma clave de idempotencia devuelve
   * el recibo original sin volver a mover saldos.
   */
  registrarPago(datos: DatosPago): ReciboPago {
    const { monto, fechaCorte, claveIdempotencia } = datos;

    const reciboPrevio = this.recibosPorClave.get(claveIdempotencia);
    if (reciboPrevio !== undefined) {
      return { ...reciboPrevio, repetido: true };
    }

    if (!this.estado.puedeRecibirPago()) {
      throw new TransicionInvalidaError(this.estado.nombre, 'registrar un pago');
    }
    if (monto.esNegativo()) {
      throw new Error('El monto de un pago no puede ser negativo');
    }

    const estadoAnterior = this.estado.nombre;
    const diasAtrasoAntes = this.diasAtraso(fechaCorte);
    const tramoAntes = clasificarTramoMora(diasAtrasoAntes);

    const gastosDelPeriodo = datos.gastosDelPeriodo ?? Dinero.cero(monto.codigoMoneda);
    const vencidas = this.cuotasVencidasImpagas(fechaCorte);
    const primeraVencida = vencidas[0];
    if (primeraVencida !== undefined && gastosDelPeriodo.esPositivo()) {
      // Los gastos se cargan a la cuota más antigua en mora, que los generó.
      primeraVencida.gastosPendientes = primeraVencida.gastosPendientes.sumar(gastosDelPeriodo);
    }

    let remanente = monto;
    const porCuota: AplicacionPorCuota[] = [];

    for (const cuota of vencidas) {
      if (!remanente.esPositivo()) break;

      const diasAtrasoCuota = calcularDiasAtraso(cuota.fechaVencimiento, fechaCorte);
      const deuda: DeudaCuota = {
        gastos: cuota.gastosPendientes,
        interesMoratorio: calcularInteresMoratorio(
          cuota.capitalPendiente,
          this.politica,
          diasAtrasoCuota,
        ),
        interesCorriente: cuota.interesPendiente,
        capital: cuota.capitalPendiente,
      };

      const resultado = aplicarPrelacion(remanente, deuda);
      const aGastos = montoAplicadoA(resultado, 'GASTOS');
      const aMora = montoAplicadoA(resultado, 'INTERES_MORATORIO');
      const aInteres = montoAplicadoA(resultado, 'INTERES_CORRIENTE');
      const aCapital = montoAplicadoA(resultado, 'CAPITAL');

      cuota.gastosPendientes = cuota.gastosPendientes.restar(aGastos);
      cuota.interesPendiente = cuota.interesPendiente.restar(aInteres);
      cuota.capitalPendiente = cuota.capitalPendiente.restar(aCapital);

      this.asentarSiPositivo('PAGO_GASTOS', aGastos, fechaCorte, cuota.numero, claveIdempotencia);
      this.asentarSiPositivo('PAGO_MORA', aMora, fechaCorte, cuota.numero, claveIdempotencia);
      this.asentarSiPositivo('PAGO_INTERES', aInteres, fechaCorte, cuota.numero, claveIdempotencia);
      this.asentarSiPositivo('PAGO_CAPITAL', aCapital, fechaCorte, cuota.numero, claveIdempotencia);

      porCuota.push({
        cuotaNumero: cuota.numero,
        diasAtraso: diasAtrasoCuota,
        aplicaciones: resultado.aplicaciones,
      });
      remanente = resultado.excedente;
    }

    const excedente = remanente;
    const destinoExcedente = excedente.esPositivo()
      ? this.aplicarExcedente(excedente, fechaCorte, claveIdempotencia)
      : ('NINGUNO' as const);

    const diasAtrasoDespues = this.diasAtraso(fechaCorte);
    const saldoEnCero = this.saldoCapital().esCero();
    this.suspenso = debeSuspenderDevengo(diasAtrasoDespues);

    this.transicionar(
      this.estado.registrarPago({ diasAtrasoResultante: diasAtrasoDespues, saldoEnCero }),
      fechaCorte,
      'asesor',
      `Pago de ${monto.toStringConMoneda()} (clave ${claveIdempotencia})`,
    );

    const recibo: ReciboPago = {
      creditoId: this.id,
      claveIdempotencia,
      montoRecibido: monto,
      porCuota,
      excedente,
      destinoExcedente,
      estadoAnterior,
      estadoNuevo: this.estado.nombre,
      diasAtrasoAntes,
      diasAtrasoDespues,
      tramoAntes,
      tramoDespues: clasificarTramoMora(diasAtrasoDespues),
      repetido: false,
    };
    this.recibosPorClave.set(claveIdempotencia, recibo);
    return recibo;
  }

  /**
   * Política de adelanto (6.6.5). Con amortización a capital el excedente se
   * aplica desde las últimas cuotas hacia atrás, es decir acorta el plazo; al
   * quedar una cuota prepagada se cancela su interés, porque esos meses ya no
   * transcurrirán. El excedente nunca se pierde.
   */
  private aplicarExcedente(
    excedente: Dinero,
    fecha: Date,
    claveIdempotencia: string,
  ): 'AMORTIZACION_CAPITAL' | 'CUOTAS_FUTURAS' {
    if (this.politica.politicaAdelanto === 'CUOTAS_FUTURAS') {
      this.saldoAFavor = this.saldoAFavor.sumar(excedente);
      return 'CUOTAS_FUTURAS';
    }

    let disponible = excedente;
    const pendientesDescendente = this.saldos
      .filter((cuota) => cuota.capitalPendiente.esPositivo())
      .sort((a, b) => b.numero - a.numero);

    for (const cuota of pendientesDescendente) {
      if (!disponible.esPositivo()) break;
      const aplicado = disponible.minimo(cuota.capitalPendiente);
      cuota.capitalPendiente = cuota.capitalPendiente.restar(aplicado);
      disponible = disponible.restar(aplicado);
      this.asentarSiPositivo('ADELANTO_CAPITAL', aplicado, fecha, cuota.numero, claveIdempotencia);
      if (cuota.capitalPendiente.esCero()) {
        cuota.interesPendiente = Dinero.cero(excedente.codigoMoneda);
      }
    }

    if (disponible.esPositivo()) {
      this.saldoAFavor = this.saldoAFavor.sumar(disponible);
    }
    return 'AMORTIZACION_CAPITAL';
  }

  // ------------------------------------------------- deterioro y recuperación

  /** Reevalúa el estado a una fecha de corte. Lo invoca el cierre (6.9). */
  actualizarPorCorte(fechaCorte: Date): void {
    const dias = this.diasAtraso(fechaCorte);
    this.suspenso = debeSuspenderDevengo(dias);
    const nuevo = this.estado.registrarVencimiento(dias);
    if (nuevo.nombre !== this.estado.nombre) {
      this.transicionar(nuevo, fechaCorte, 'proceso-cierre', `Cuota vencida con ${dias} días de atraso`);
    }
  }

  reestructurar(fecha: Date, usuarioOProceso = 'comite'): void {
    this.transicionar(
      this.estado.reestructurar(),
      fecha,
      usuarioOProceso,
      'Acuerdo de nuevas condiciones autorizado por el comité',
    );
    // La marca no se borra: sigue contando como cartera en riesgo (6.8).
    this.reestructurado = true;
  }

  cumplirNuevoPlan(fecha: Date, usuarioOProceso = 'proceso-cierre'): void {
    this.transicionar(
      this.estado.cumplirNuevoPlan(),
      fecha,
      usuarioOProceso,
      'Cumple la política de cura; sigue marcado en riesgo',
    );
  }

  /** Baja contable por superar los 120 días sin arreglo (6.7). */
  declararIncobrable(fechaCorte: Date, usuarioOProceso = 'proceso-cierre'): void {
    const dias = this.diasAtraso(fechaCorte);
    const saldo = this.saldoCapital();
    this.transicionar(
      this.estado.declararIncobrable(dias),
      fechaCorte,
      usuarioOProceso,
      `Supera los ${LIMITES_TRAMO.VENCIDO} días de atraso sin arreglo (${dias} días)`,
    );
    this.asentarSiPositivo('CASTIGO_INCOBRABLE', saldo, fechaCorte, null, null);
    for (const cuota of this.saldos) {
      cuota.capitalPendiente = Dinero.cero(saldo.codigoMoneda);
      cuota.interesPendiente = Dinero.cero(saldo.codigoMoneda);
      cuota.gastosPendientes = Dinero.cero(saldo.codigoMoneda);
    }
  }

  /** Cobro de la casa de cobro externa; el crédito no vuelve a la cartera. */
  registrarRecuperacionIncobrable(monto: Dinero, fecha: Date): void {
    this.transicionar(
      this.estado.registrarRecuperacion(),
      fecha,
      'casa-de-cobro',
      'Recuperación de incobrable en cuenta separada',
    );
    this.asentarSiPositivo('RECUPERACION_INCOBRABLE', monto, fecha, null, null);
  }

  // ------------------------------------------------------------- auditoría

  saldoSegunMayor(): Dinero {
    return saldoCapitalDesdeMovimientos(this.movimientos, this.montoSolicitado);
  }

  private transicionar(
    nuevoEstado: EstadoCredito,
    fecha: Date,
    usuarioOProceso: string,
    motivo: string,
  ): void {
    const desde = this.estado.nombre;
    this.estado = nuevoEstado;
    // El historial es append-only: nunca se borra (6.7).
    this.historial.push({
      desde,
      hacia: nuevoEstado.nombre,
      fecha: new Date(fecha.getTime()),
      usuarioOProceso,
      motivo,
    });
  }

  private asentar(
    tipo: TipoMovimiento,
    monto: Dinero,
    fecha: Date,
    cuotaNumero: number | null,
    claveIdempotencia: string | null,
  ): void {
    this.contadorMovimientos += 1;
    this.movimientos.push({
      numero: this.contadorMovimientos,
      creditoId: this.id,
      tipo,
      monto,
      fecha: new Date(fecha.getTime()),
      cuotaNumero,
      claveIdempotencia,
    });
  }

  private asentarSiPositivo(
    tipo: TipoMovimiento,
    monto: Dinero,
    fecha: Date,
    cuotaNumero: number | null,
    claveIdempotencia: string | null,
  ): void {
    if (monto.esPositivo()) {
      this.asentar(tipo, monto, fecha, cuotaNumero, claveIdempotencia);
    }
  }
}
