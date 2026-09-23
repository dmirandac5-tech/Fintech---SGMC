/**
 * Correcciones CP-04 del Proyecto 2 (seccion 7.7).
 * CP-04.1: transicion en_mora -> cancelado (ya existe en estado-credito.ts).
 * CP-04.2: suspension del devengo de interes corriente a los 90 dias.
 * No se modifica el nucleo: se verifica el comportamiento con pruebas.
 */
import { describe, it, expect } from 'vitest';
import {
  SOLICITADO,
  EN_MORA,
  CANCELADO,
  TransicionInvalidaError,
} from '../src/dominio/estado-credito';
import { debeSuspenderDevengo, DIAS_SUSPENSION_DEVENGO } from '../src/dominio/calculadora-mora';

describe('CP-04.1 - transicion en_mora -> cancelado', () => {
  it('Un credito en mora que paga todo el saldo pasa a CANCELADO', () => {
    const resultado = EN_MORA.registrarPago({
      diasAtrasoResultante: 0,
      saldoEnCero: true,
    });
    expect(resultado.nombre).toBe('CANCELADO');
  });

  it('Un credito en mora que regulariza (atraso a cero) pasa a VIGENTE, no a CANCELADO', () => {
    const resultado = EN_MORA.registrarPago({
      diasAtrasoResultante: 0,
      saldoEnCero: false,
    });
    expect(resultado.nombre).toBe('VIGENTE');
  });

  it('Sigue siendo imposible pagar un credito SOLICITADO', () => {
    expect(() =>
      SOLICITADO.registrarPago({ diasAtrasoResultante: 0, saldoEnCero: true }),
    ).toThrow(TransicionInvalidaError);
  });
});

describe('CP-04.2 - suspension del devengo de interes corriente', () => {
  it('El umbral de suspension es 90 dias', () => {
    expect(DIAS_SUSPENSION_DEVENGO).toBe(90);
  });

  it('Con 90 dias o menos NO se suspende el devengo', () => {
    expect(debeSuspenderDevengo(0)).toBe(false);
    expect(debeSuspenderDevengo(45)).toBe(false);
    expect(debeSuspenderDevengo(90)).toBe(false);
  });

  it('A partir del dia 91 SI se suspende el devengo', () => {
    expect(debeSuspenderDevengo(91)).toBe(true);
    expect(debeSuspenderDevengo(100)).toBe(true);
    expect(debeSuspenderDevengo(120)).toBe(true);
  });

  it('Entre un corte al dia 90 y otro al dia 100, el devengo no aumenta', () => {
    const devengaA90 = !debeSuspenderDevengo(90);
    const devengaA100 = !debeSuspenderDevengo(100);
    expect(devengaA90).toBe(true);
    expect(devengaA100).toBe(false);
  });
});