/**
 * Prelación de pagos (6.6). Cada eslabón consume lo que adeuda su rubro y pasa
 * el remanente al siguiente. El orden vive únicamente en construirCadenaPrelacion.
 *
 *   1. Gastos y comisiones
 *   2. Interés moratorio
 *   3. Interés corriente
 *   4. Capital
 */

import { Dinero } from './dinero';

export type RubroPago = 'GASTOS' | 'INTERES_MORATORIO' | 'INTERES_CORRIENTE' | 'CAPITAL';

/** Rubros que adeuda una cuota vencida (6.6.1). */
export interface DeudaCuota {
  readonly gastos: Dinero;
  readonly interesMoratorio: Dinero;
  readonly interesCorriente: Dinero;
  readonly capital: Dinero;
}

export interface AplicacionPago {
  readonly rubro: RubroPago;
  readonly monto: Dinero;
}

export interface ResultadoPrelacion {
  readonly aplicaciones: readonly AplicacionPago[];
  readonly excedente: Dinero;
  readonly quedaSaldada: boolean;
}

/** Estado que recorre la cadena. */
interface TransitoPago {
  readonly remanente: Dinero;
  readonly aplicaciones: readonly AplicacionPago[];
}

export abstract class EslabonPrelacion {
  private siguiente: EslabonPrelacion | null = null;

  constructor(public readonly rubro: RubroPago) {}

  /** Devuelve el eslabón enlazado para poder encadenar de forma fluida. */
  encadenar(siguiente: EslabonPrelacion): EslabonPrelacion {
    this.siguiente = siguiente;
    return siguiente;
  }

  protected abstract montoAdeudado(deuda: DeudaCuota): Dinero;

  manejar(transito: TransitoPago, deuda: DeudaCuota): TransitoPago {
    const adeudado = this.montoAdeudado(deuda);
    const aplicado = transito.remanente.minimo(adeudado);
    const siguienteTransito: TransitoPago = {
      remanente: transito.remanente.restar(aplicado),
      aplicaciones: [...transito.aplicaciones, { rubro: this.rubro, monto: aplicado }],
    };
    return this.siguiente === null
      ? siguienteTransito
      : this.siguiente.manejar(siguienteTransito, deuda);
  }
}

class EslabonGastos extends EslabonPrelacion {
  constructor() {
    super('GASTOS');
  }
  protected override montoAdeudado(deuda: DeudaCuota): Dinero {
    return deuda.gastos;
  }
}

class EslabonInteresMoratorio extends EslabonPrelacion {
  constructor() {
    super('INTERES_MORATORIO');
  }
  protected override montoAdeudado(deuda: DeudaCuota): Dinero {
    return deuda.interesMoratorio;
  }
}

class EslabonInteresCorriente extends EslabonPrelacion {
  constructor() {
    super('INTERES_CORRIENTE');
  }
  protected override montoAdeudado(deuda: DeudaCuota): Dinero {
    return deuda.interesCorriente;
  }
}

class EslabonCapital extends EslabonPrelacion {
  constructor() {
    super('CAPITAL');
  }
  protected override montoAdeudado(deuda: DeudaCuota): Dinero {
    return deuda.capital;
  }
}

/** Arma la cadena en el orden de 6.6.2 y devuelve su primer eslabón. */
export function construirCadenaPrelacion(): EslabonPrelacion {
  const gastos = new EslabonGastos();
  gastos
    .encadenar(new EslabonInteresMoratorio())
    .encadenar(new EslabonInteresCorriente())
    .encadenar(new EslabonCapital());
  return gastos;
}

export function totalAdeudado(deuda: DeudaCuota): Dinero {
  return deuda.gastos
    .sumar(deuda.interesMoratorio)
    .sumar(deuda.interesCorriente)
    .sumar(deuda.capital);
}

/**
 * Recorre la cadena con el monto recibido. Los tres escenarios de 6.6.3 a
 * 6.6.5 se distinguen por el remanente, sin ramificaciones aparte. Un pago
 * insuficiente se aplica hasta donde alcance; nunca se rechaza.
 */
export function aplicarPrelacion(montoRecibido: Dinero, deuda: DeudaCuota): ResultadoPrelacion {
  if (montoRecibido.esNegativo()) {
    throw new Error('El monto de un pago no puede ser negativo');
  }
  const cadena = construirCadenaPrelacion();
  const resultado = cadena.manejar(
    { remanente: montoRecibido, aplicaciones: [] },
    deuda,
  );
  return {
    aplicaciones: resultado.aplicaciones,
    excedente: resultado.remanente,
    quedaSaldada: !montoRecibido.esMenorQue(totalAdeudado(deuda)),
  };
}

export function montoAplicadoA(
  resultado: ResultadoPrelacion,
  rubro: RubroPago,
): Dinero {
  const aplicacion = resultado.aplicaciones.find((a) => a.rubro === rubro);
  return aplicacion?.monto ?? Dinero.cero();
}
