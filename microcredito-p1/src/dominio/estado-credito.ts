/**
 * Ciclo de vida del crédito (6.7 y tabla 6.7.1).
 *
 * Cada estado es un objeto que implementa solo las operaciones que ese estado
 * admite; la clase base rechaza el resto. Así una transición inválida no
 * depende de que alguien recuerde escribir un if.
 *
 * Los tramos de mora no viven aquí: son un atributo derivado (calculadora-mora).
 */

import { LIMITES_TRAMO } from './calculadora-mora';

export type NombreEstadoCredito =
  | 'SOLICITADO'
  | 'APROBADO'
  | 'DESEMBOLSADO'
  | 'VIGENTE'
  | 'EN_MORA'
  | 'REESTRUCTURADO'
  | 'RECHAZADO'
  | 'ANULADO'
  | 'CANCELADO'
  | 'INCOBRABLE';

export class TransicionInvalidaError extends Error {
  constructor(
    public readonly estado: NombreEstadoCredito,
    public readonly operacion: string,
  ) {
    super(`Transición inválida: no se puede "${operacion}" un crédito en estado ${estado}`);
    this.name = 'TransicionInvalidaError';
  }
}

/** Resultado de un pago, que determina el estado destino. */
export interface ResultadoPagoParaEstado {
  readonly diasAtrasoResultante: number;
  readonly saldoEnCero: boolean;
}

export interface EstadoCredito {
  readonly nombre: NombreEstadoCredito;
  readonly esTerminal: boolean;
  puedeRecibirPago(): boolean;
  aprobar(): EstadoCredito;
  rechazar(): EstadoCredito;
  desembolsar(): EstadoCredito;
  iniciarPlan(): EstadoCredito;
  anular(): EstadoCredito;
  registrarVencimiento(diasAtraso: number): EstadoCredito;
  registrarPago(resultado: ResultadoPagoParaEstado): EstadoCredito;
  reestructurar(): EstadoCredito;
  cumplirNuevoPlan(): EstadoCredito;
  declararIncobrable(diasAtraso: number): EstadoCredito;
  registrarRecuperacion(): EstadoCredito;
}

/** Por defecto toda operación es inválida; cada estado habilita las suyas. */
abstract class EstadoBase implements EstadoCredito {
  abstract readonly nombre: NombreEstadoCredito;
  readonly esTerminal: boolean = false;

  puedeRecibirPago(): boolean {
    return false;
  }

  protected rechazarOperacion(operacion: string): never {
    throw new TransicionInvalidaError(this.nombre, operacion);
  }

  aprobar(): EstadoCredito {
    return this.rechazarOperacion('aprobar');
  }
  rechazar(): EstadoCredito {
    return this.rechazarOperacion('rechazar');
  }
  desembolsar(): EstadoCredito {
    return this.rechazarOperacion('desembolsar');
  }
  iniciarPlan(): EstadoCredito {
    return this.rechazarOperacion('iniciar el plan');
  }
  anular(): EstadoCredito {
    return this.rechazarOperacion('anular');
  }
  registrarVencimiento(_diasAtraso: number): EstadoCredito {
    return this.rechazarOperacion('registrar el vencimiento de una cuota');
  }
  registrarPago(_resultado: ResultadoPagoParaEstado): EstadoCredito {
    return this.rechazarOperacion('registrar un pago');
  }
  reestructurar(): EstadoCredito {
    return this.rechazarOperacion('reestructurar');
  }
  cumplirNuevoPlan(): EstadoCredito {
    return this.rechazarOperacion('dar por cumplido el nuevo plan');
  }
  declararIncobrable(_diasAtraso: number): EstadoCredito {
    return this.rechazarOperacion('declarar incobrable');
  }
  registrarRecuperacion(): EstadoCredito {
    return this.rechazarOperacion('registrar una recuperación de incobrable');
  }
}

class SolicitadoState extends EstadoBase {
  readonly nombre = 'SOLICITADO' as const;
  override aprobar(): EstadoCredito {
    return APROBADO;
  }
  override rechazar(): EstadoCredito {
    return RECHAZADO;
  }
}

class AprobadoState extends EstadoBase {
  readonly nombre = 'APROBADO' as const;
  override desembolsar(): EstadoCredito {
    return DESEMBOLSADO;
  }
  /** El cliente desiste o expira la aprobación, siempre antes del desembolso. */
  override anular(): EstadoCredito {
    return ANULADO;
  }
}

/** Estado instantáneo: la tabla 6.7.1 lo resuelve como "desembolsado a vigente". */
class DesembolsadoState extends EstadoBase {
  readonly nombre = 'DESEMBOLSADO' as const;
  override iniciarPlan(): EstadoCredito {
    return VIGENTE;
  }
}

class VigenteState extends EstadoBase {
  readonly nombre = 'VIGENTE' as const;
  override puedeRecibirPago(): boolean {
    return true;
  }
  override registrarVencimiento(diasAtraso: number): EstadoCredito {
    return diasAtraso >= 1 ? EN_MORA : VIGENTE;
  }
  override registrarPago(resultado: ResultadoPagoParaEstado): EstadoCredito {
    if (resultado.saldoEnCero) return CANCELADO;
    return resultado.diasAtrasoResultante >= 1 ? EN_MORA : VIGENTE;
  }
  override reestructurar(): EstadoCredito {
    return REESTRUCTURADO;
  }
}

class EnMoraState extends EstadoBase {
  readonly nombre = 'EN_MORA' as const;
  override puedeRecibirPago(): boolean {
    return true;
  }
  override registrarVencimiento(_diasAtraso: number): EstadoCredito {
    // Sigue en mora; lo que cambia es el tramo, que es derivado.
    return EN_MORA;
  }
  /** Atraso en cero regulariza a vigente; un abono parcial mantiene la mora. */
  override registrarPago(resultado: ResultadoPagoParaEstado): EstadoCredito {
    if (resultado.saldoEnCero) return CANCELADO;
    return resultado.diasAtrasoResultante === 0 ? VIGENTE : EN_MORA;
  }
  override reestructurar(): EstadoCredito {
    return REESTRUCTURADO;
  }
  override declararIncobrable(diasAtraso: number): EstadoCredito {
    if (diasAtraso <= LIMITES_TRAMO.VENCIDO) {
      throw new Error(
        `Solo se declara incobrable un crédito con más de ${LIMITES_TRAMO.VENCIDO} días de atraso; tiene ${diasAtraso}`,
      );
    }
    return INCOBRABLE;
  }
}

class ReestructuradoState extends EstadoBase {
  readonly nombre = 'REESTRUCTURADO' as const;
  override puedeRecibirPago(): boolean {
    return true;
  }
  override registrarVencimiento(diasAtraso: number): EstadoCredito {
    return diasAtraso >= 1 ? EN_MORA : REESTRUCTURADO;
  }
  override registrarPago(resultado: ResultadoPagoParaEstado): EstadoCredito {
    if (resultado.saldoEnCero) return CANCELADO;
    return resultado.diasAtrasoResultante >= 1 ? EN_MORA : REESTRUCTURADO;
  }
  /** Vuelve a vigente por política de cura, pero conserva la marca de riesgo (6.8). */
  override cumplirNuevoPlan(): EstadoCredito {
    return VIGENTE;
  }
}

class RechazadoState extends EstadoBase {
  readonly nombre = 'RECHAZADO' as const;
  override readonly esTerminal = true;
}

class AnuladoState extends EstadoBase {
  readonly nombre = 'ANULADO' as const;
  override readonly esTerminal = true;
}

class CanceladoState extends EstadoBase {
  readonly nombre = 'CANCELADO' as const;
  override readonly esTerminal = true;
}

/** Baja contable: la recuperación se registra aparte y no reactiva el crédito. */
class IncobrableState extends EstadoBase {
  readonly nombre = 'INCOBRABLE' as const;
  override readonly esTerminal = true;
  override registrarRecuperacion(): EstadoCredito {
    return INCOBRABLE;
  }
}

export const SOLICITADO: EstadoCredito = new SolicitadoState();
export const APROBADO: EstadoCredito = new AprobadoState();
export const DESEMBOLSADO: EstadoCredito = new DesembolsadoState();
export const VIGENTE: EstadoCredito = new VigenteState();
export const EN_MORA: EstadoCredito = new EnMoraState();
export const REESTRUCTURADO: EstadoCredito = new ReestructuradoState();
export const RECHAZADO: EstadoCredito = new RechazadoState();
export const ANULADO: EstadoCredito = new AnuladoState();
export const CANCELADO: EstadoCredito = new CanceladoState();
export const INCOBRABLE: EstadoCredito = new IncobrableState();

const ESTADOS: Readonly<Record<NombreEstadoCredito, EstadoCredito>> = {
  SOLICITADO,
  APROBADO,
  DESEMBOLSADO,
  VIGENTE,
  EN_MORA,
  REESTRUCTURADO,
  RECHAZADO,
  ANULADO,
  CANCELADO,
  INCOBRABLE,
};

export function estadoPorNombre(nombre: NombreEstadoCredito): EstadoCredito {
  return ESTADOS[nombre];
}
