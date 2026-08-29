/**
 * Plan de amortización (6.4).
 *
 * La estrategia decide la cuota del período (Strategy); el constructor recorre
 * los períodos, ajusta la última cuota y verifica los invariantes antes de
 * devolver el plan (Builder).
 */

import { Dinero } from './dinero';

export interface ContextoPeriodo {
  readonly capital: Dinero;
  readonly tasaPeriodica: number;
  readonly numeroCuotas: number;
  readonly numeroPeriodo: number;
  readonly saldoInicial: Dinero;
  readonly interesDelPeriodo: Dinero;
}

export interface EstrategiaAmortizacion {
  readonly nombre: string;
  cuotaDelPeriodo(contexto: ContextoPeriodo): Dinero;
}

function factorCuotaFrancesa(tasaPeriodica: number, numeroCuotas: number): number {
  const potencia = Math.pow(1 + tasaPeriodica, numeroCuotas);
  return (tasaPeriodica * potencia) / (potencia - 1);
}

export function cuotaFijaFrancesa(
  capital: Dinero,
  tasaPeriodica: number,
  numeroCuotas: number,
): Dinero {
  if (!Number.isInteger(numeroCuotas) || numeroCuotas <= 0) {
    throw new Error(`El número de cuotas debe ser un entero positivo, se recibió ${numeroCuotas}`);
  }
  // Con i = 0 el denominador del factor se anula.
  if (tasaPeriodica === 0) {
    return capital.dividirEntre(numeroCuotas);
  }
  return capital.multiplicarPor(factorCuotaFrancesa(tasaPeriodica, numeroCuotas));
}

/** Método base del Sistema: cuota fija (6.4). */
export const metodoFrances: EstrategiaAmortizacion = {
  nombre: 'FRANCES',
  cuotaDelPeriodo({ capital, tasaPeriodica, numeroCuotas }) {
    return cuotaFijaFrancesa(capital, tasaPeriodica, numeroCuotas);
  },
};

/** Amortización constante: la cuota baja período a período. */
export const metodoSaldosInsolutos: EstrategiaAmortizacion = {
  nombre: 'SALDOS_INSOLUTOS',
  cuotaDelPeriodo({ capital, numeroCuotas, interesDelPeriodo }) {
    return capital.dividirEntre(numeroCuotas).sumar(interesDelPeriodo);
  },
};

export interface Cuota {
  readonly numero: number;
  readonly saldoInicial: Dinero;
  readonly montoCuota: Dinero;
  readonly interes: Dinero;
  readonly amortizacion: Dinero;
  readonly saldoFinal: Dinero;
  readonly fechaVencimiento: Date;
}

export interface PlanAmortizacion {
  readonly capital: Dinero;
  readonly tasaPeriodica: number;
  readonly numeroCuotas: number;
  readonly metodo: string;
  readonly cuotas: readonly Cuota[];
}

export interface ParametrosPlan {
  readonly capital: Dinero;
  readonly tasaPeriodica: number;
  readonly numeroCuotas: number;
  /** La cuota k vence k meses después del desembolso. */
  readonly fechaDesembolso: Date;
  readonly estrategia?: EstrategiaAmortizacion;
}

function sumarMeses(fecha: Date, meses: number): Date {
  const resultado = new Date(fecha.getTime());
  const diaOriginal = resultado.getUTCDate();
  resultado.setUTCDate(1);
  resultado.setUTCMonth(resultado.getUTCMonth() + meses);
  const ultimoDiaDelMes = new Date(
    Date.UTC(resultado.getUTCFullYear(), resultado.getUTCMonth() + 1, 0),
  ).getUTCDate();
  resultado.setUTCDate(Math.min(diaOriginal, ultimoDiaDelMes));
  return resultado;
}

/**
 * Construye el plan completo:
 *   interes_k      = redondear(saldo_(k-1) * i)
 *   amortizacion_k = cuota_k - interes_k
 *   saldo_k        = saldo_(k-1) - amortizacion_k
 *
 * En la última cuota, amortizacion_n = saldo_(n-1) y cuota_n suma su interés.
 */
export function construirPlanAmortizacion(parametros: ParametrosPlan): PlanAmortizacion {
  const {
    capital,
    tasaPeriodica,
    numeroCuotas,
    fechaDesembolso,
    estrategia = metodoFrances,
  } = parametros;

  if (!capital.esPositivo()) {
    throw new Error('El capital desembolsado debe ser positivo');
  }
  if (!Number.isInteger(numeroCuotas) || numeroCuotas <= 0) {
    throw new Error(`El número de cuotas debe ser un entero positivo, se recibió ${numeroCuotas}`);
  }
  if (tasaPeriodica < 0) {
    throw new Error('La tasa periódica no puede ser negativa');
  }

  const cero = Dinero.cero(capital.codigoMoneda);
  const cuotas: Cuota[] = [];
  let saldo = capital;

  for (let numero = 1; numero <= numeroCuotas; numero += 1) {
    const interes = saldo.multiplicarPor(tasaPeriodica);
    const esUltima = numero === numeroCuotas;

    let amortizacion: Dinero;
    let montoCuota: Dinero;

    if (esUltima) {
      // Ajuste de cuadre: absorbe el redondeo acumulado de las cuotas anteriores.
      amortizacion = saldo;
      montoCuota = amortizacion.sumar(interes);
    } else {
      montoCuota = estrategia.cuotaDelPeriodo({
        capital,
        tasaPeriodica,
        numeroCuotas,
        numeroPeriodo: numero,
        saldoInicial: saldo,
        interesDelPeriodo: interes,
      });
      amortizacion = montoCuota.restar(interes);
      if (amortizacion.esNegativo()) {
        throw new Error(
          `La cuota ${numero} no cubre ni el interés del período: revise tasa y plazo`,
        );
      }
    }

    const saldoFinal = esUltima ? cero : saldo.restar(amortizacion);
    cuotas.push({
      numero,
      saldoInicial: saldo,
      montoCuota,
      interes,
      amortizacion,
      saldoFinal,
      fechaVencimiento: sumarMeses(fechaDesembolso, numero),
    });
    saldo = saldoFinal;
  }

  const plan: PlanAmortizacion = {
    capital,
    tasaPeriodica,
    numeroCuotas,
    metodo: estrategia.nombre,
    cuotas,
  };

  verificarInvariantesDelPlan(plan);
  return plan;
}

/** Invariantes de 6.10, comprobados antes de entregar el plan. */
function verificarInvariantesDelPlan(plan: PlanAmortizacion): void {
  const suma = sumaAmortizaciones(plan);
  if (!suma.esIgualA(plan.capital)) {
    throw new Error(
      `Invariante violado: la suma de amortizaciones (${suma}) no es igual al capital (${plan.capital})`,
    );
  }
  const ultima = plan.cuotas[plan.cuotas.length - 1];
  if (ultima === undefined || !ultima.saldoFinal.esCero()) {
    throw new Error('Invariante violado: el saldo tras la última cuota debe ser exactamente 0.00');
  }
  for (const cuota of plan.cuotas) {
    if (cuota.saldoFinal.esNegativo()) {
      throw new Error(`Invariante violado: saldo negativo en la cuota ${cuota.numero}`);
    }
  }
}

export function cuotaNumero(plan: PlanAmortizacion, numero: number): Cuota {
  const cuota = plan.cuotas.find((c) => c.numero === numero);
  if (cuota === undefined) {
    throw new Error(`El plan no tiene una cuota número ${numero}`);
  }
  return cuota;
}

export function sumaAmortizaciones(plan: PlanAmortizacion): Dinero {
  return plan.cuotas.reduce(
    (acumulado, cuota) => acumulado.sumar(cuota.amortizacion),
    Dinero.cero(plan.capital.codigoMoneda),
  );
}

export function totalIntereses(plan: PlanAmortizacion): Dinero {
  return plan.cuotas.reduce(
    (acumulado, cuota) => acumulado.sumar(cuota.interes),
    Dinero.cero(plan.capital.codigoMoneda),
  );
}

export function totalAPagar(plan: PlanAmortizacion): Dinero {
  return plan.cuotas.reduce(
    (acumulado, cuota) => acumulado.sumar(cuota.montoCuota),
    Dinero.cero(plan.capital.codigoMoneda),
  );
}
