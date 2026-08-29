/**
 * Cartera en riesgo (6.8).
 *
 * Al riesgo entra el saldo de capital completo de los créditos con más de 30
 * días de atraso, más los reestructurados aunque estén al día. Los incobrables
 * quedan fuera del numerador y también de la base: ya salieron de la cartera.
 */

import { DIAS_UMBRAL_CARTERA_EN_RIESGO, clasificarTramoMora, type TramoMora } from './calculadora-mora';
import { Dinero, type CodigoMoneda } from './dinero';

export interface CreditoEnCartera {
  readonly id: string;
  readonly saldoCapital: Dinero;
  readonly diasAtraso: number;
  readonly reestructurado: boolean;
  readonly incobrable: boolean;
}

export interface DetalleCredito {
  readonly id: string;
  readonly saldoCapital: Dinero;
  readonly tramo: TramoMora;
  readonly enRiesgo: boolean;
  readonly excluido: boolean;
  readonly motivo: string;
}

export interface CarteraEnRiesgo {
  readonly carteraActiva: Dinero;
  readonly carteraEnRiesgo: Dinero;
  /** Proporción entre 0 y 1. */
  readonly proporcion: number;
  readonly detalle: readonly DetalleCredito[];
}

function estaEnRiesgo(credito: CreditoEnCartera): boolean {
  return (
    !credito.incobrable &&
    (credito.diasAtraso > DIAS_UMBRAL_CARTERA_EN_RIESGO || credito.reestructurado)
  );
}

function motivoDe(credito: CreditoEnCartera): string {
  if (credito.incobrable) return 'Incobrable: ya salió de la cartera activa';
  if (credito.diasAtraso > DIAS_UMBRAL_CARTERA_EN_RIESGO) {
    return `Supera los ${DIAS_UMBRAL_CARTERA_EN_RIESGO} días de atraso (${credito.diasAtraso})`;
  }
  if (credito.reestructurado) return 'Reestructurado: cuenta en riesgo aunque esté al día';
  return `No supera los ${DIAS_UMBRAL_CARTERA_EN_RIESGO} días de atraso (${credito.diasAtraso})`;
}

export function calcularCarteraEnRiesgo(
  creditos: readonly CreditoEnCartera[],
  moneda: CodigoMoneda = 'GTQ',
): CarteraEnRiesgo {
  const cero = Dinero.cero(moneda);
  const activos = creditos.filter((credito) => !credito.incobrable);

  const carteraActiva = activos.reduce((total, c) => total.sumar(c.saldoCapital), cero);
  const carteraEnRiesgo = activos
    .filter(estaEnRiesgo)
    .reduce((total, c) => total.sumar(c.saldoCapital), cero);

  const proporcion = carteraActiva.esCero()
    ? 0
    : Number(carteraEnRiesgo.centavosValor()) / Number(carteraActiva.centavosValor());

  const detalle: DetalleCredito[] = creditos.map((credito) => ({
    id: credito.id,
    saldoCapital: credito.saldoCapital,
    tramo: clasificarTramoMora(credito.diasAtraso),
    enRiesgo: estaEnRiesgo(credito),
    excluido: credito.incobrable,
    motivo: motivoDe(credito),
  }));

  if (proporcion < 0 || proporcion > 1) {
    throw new Error(`Invariante violado: la cartera en riesgo debe estar entre 0 y 1, se obtuvo ${proporcion}`);
  }

  return { carteraActiva, carteraEnRiesgo, proporcion, detalle };
}

export function porcentajeCarteraEnRiesgo(cartera: CarteraEnRiesgo, decimales = 2): number {
  const factor = Math.pow(10, decimales);
  return Math.round(cartera.proporcion * 100 * factor) / factor;
}

export interface ReporteCarteraEnRiesgo extends CarteraEnRiesgo {
  readonly porcentaje: number;
  readonly dadoPorIncobrableEnElPeriodo: Dinero;
}

/**
 * El porcentaje se reporta junto con lo dado por incobrable en el período
 * (6.8): castigar un crédito malo baja el indicador sin haber cobrado nada, y
 * los dos números juntos evitan esa lectura engañosa.
 */
export function generarReporteCarteraEnRiesgo(
  creditos: readonly CreditoEnCartera[],
  incobrablesDelPeriodo: readonly CreditoEnCartera[] = [],
  moneda: CodigoMoneda = 'GTQ',
): ReporteCarteraEnRiesgo {
  const cartera = calcularCarteraEnRiesgo(creditos, moneda);
  const dadoPorIncobrableEnElPeriodo = incobrablesDelPeriodo.reduce(
    (total, credito) => total.sumar(credito.saldoCapital),
    Dinero.cero(moneda),
  );
  return {
    ...cartera,
    porcentaje: porcentajeCarteraEnRiesgo(cartera),
    dadoPorIncobrableEnElPeriodo,
  };
}
