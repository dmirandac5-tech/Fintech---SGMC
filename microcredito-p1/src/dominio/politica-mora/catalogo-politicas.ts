/**
 * Catalogo de politicas de mora: resuelve que politica aplica segun la
 * fecha de otorgamiento del credito (CP-03, seccion 7.6).
 * Un credito otorgado antes del 1 de octubre de 2026 usa la politica
 * plana al 24%; uno posterior usa la escalonada por tramos.

 * La politica es un parametro versionado con vigencia, no una constante: el
 * motor de calculo no cambia, solo se elige la politica correcta aqui.

 */
import { Dinero } from '../dinero';
import { calcularMoratorioPlano } from './politica-plana';
import { calcularMoratorioEscalonado } from './politica-escalonada';

/** Fecha de corte de la politica escalonada (CP-01, entra en vigor el 1 de octubre de 2026). */
export const FECHA_VIGENCIA_ESCALONADA = new Date(Date.UTC(2026, 9, 1)); // 1 de octubre de 2026

/**
 * Decide que politica de mora corresponde a un credito segun su fecha de
 * otorgamiento. Devuelve la funcion de calculo correcta.
 */
export function politicaMoraParaCredito(
  fechaOtorgamiento: Date,
): (capitalEnMora: Dinero, diasAtraso: number) => Dinero {
  if (fechaOtorgamiento.getTime() < FECHA_VIGENCIA_ESCALONADA.getTime()) {
    // Otorgado antes del 1 de octubre de 2026: politica plana del P1.
    return calcularMoratorioPlano;
  }
  // Otorgado el 1 de octubre de  ́2026 o despues: politica escalonada.
  return calcularMoratorioEscalonado;

}

/**
 * Calcula el interes moratorio del credito aplicando la politica correcta
 * segun su fecha de otorgamiento. Es la funcion que usa el resto del sistema.
 */
export function calcularMoratorioPorPolitica(
  capitalEnMora: Dinero,
  diasAtraso: number,
  fechaOtorgamiento: Date,
): Dinero {
  return politicaMoraParaCredito(fechaOtorgamiento)(capitalEnMora, diasAtraso);
}