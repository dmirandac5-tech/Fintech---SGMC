/**
 * Politica de mora escalonada por tramo de atraso (CP-01, seccion 7.2 y 7.3).
 * Cada tramo tiene su propia TNA moratoria. El moratorio se calcula recorriendo
 * los tramos por los que paso la cuota, no aplicando la tasa del tramo actual
 * a todos los dias. El redondeo se hace UNA sola vez al final (7.3).
 */
import { Dinero } from '../dinero';
import { TramoMora } from '../calculadora-mora';
import { clasificarTramo, diasEnTramo, tramoSiguiente } from './clasificacion-tramo';

/** TNA moratoria por tramo (tabla CP-01, seccion 7.2). */
export const TNA_MORATORIA_POR_TRAMO: Readonly<Record<TramoMora, number>> = {
  AL_DIA: 0,
  MORA_1: 0.18, // 18% nominal anual
  MORA_2: 0.24, // 24% nominal anual
  MORA_3: 0.30, // 30% nominal anual
  VENCIDO: 0.36, // 36% nominal anual
  INCOBRABLE: 0, // no devenga (baja contable)
};

/** Base de conteo fija del enunciado: Actual/360. */
const DIAS_BASE = 360;

/** Tasa diaria de un tramo: TNA / 360. */
export function tasaDiariaTramo(tramo: TramoMora): number {
  return TNA_MORATORIA_POR_TRAMO[tramo] / DIAS_BASE;
}

/**
 * Interes moratorio de una cuota vencida con politica escalonada.
 *
 * interes = capital_en_mora * sum(tasa_diaria(tramo) * dias_en_tramo)
 *
 * Se redondea UNA sola vez, a 2 decimales medio hacia arriba, sobre el total.
 * Nunca tramo por tramo (eso daria 18.15 en vez de 18.14 en el caso M-2).
 */
export function calcularMoratorioEscalonado(
  capitalEnMora: Dinero,
  diasAtraso: number,
): Dinero {
  if (diasAtraso < 0) {
    throw new Error(`Los dias de atraso no pueden ser negativos: ${diasAtraso}`);
  }
  if (capitalEnMora.esNegativo()) {
    throw new Error('El capital en mora no puede ser negativo');
  }
  if (diasAtraso === 0 || capitalEnMora.esCero()) {
    return Dinero.cero(capitalEnMora.codigoMoneda);
  }

  // Suma de (tasa_diaria * dias_en_tramo) recorriendo todos los tramos.
  let acumuladoTasaPorDias = 0;
  let tramo: TramoMora = 'MORA_1';
  while (tramo !== null) {
    const dias = diasEnTramo(diasAtraso, tramo);
    if (dias > 0) {
      acumuladoTasaPorDias += tasaDiariaTramo(tramo) * dias;
    }
    const siguiente = tramoSiguiente(tramo);
    if (siguiente === null) break;
    tramo = siguiente;
  }

  // Multiplicar una sola vez y redondear al final (7.3).
  return capitalEnMora.multiplicarPor(acumuladoTasaPorDias);
}