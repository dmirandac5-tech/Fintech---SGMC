/**
 * Politica de mora retroactiva (SOLO para la prueba de sustituibilidad de Liskov).
 * Aplica la tasa del tramo actual a TODOS los dias de atraso.
 * El enunciado (7.3) la descarta como regla del sistema: se usa unicamente
 * para verificar que las tres politicas son intercambiables sin romper el motor.
 */
import { Dinero } from '../dinero';
import { TramoMora } from '../calculadora-mora';
import { clasificarTramo } from './clasificacion-tramo';
import { tasaDiariaTramo } from './politica-escalonada';

/**
 * Interes moratorio con politica retroactiva.
 * interes = capital_en_mora * tasa_diaria(tramo_actual) * dias_totales
 * Se redondea una sola vez al final.
 */
export function calcularMoratorioRetroactivo(
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
  const tramo: TramoMora = clasificarTramo(diasAtraso);
  return capitalEnMora.multiplicarPor(tasaDiariaTramo(tramo) * diasAtraso);
}