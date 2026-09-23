/**
 * Contrato comun de las politicas de mora (sustitucion de Liskov, seccion 8.2).
 * La misma bateria de casos se ejecuta contra las tres politicas (plana,
 * escalonada y retroactiva) para verificar que ninguna rompe los invariantes.
 * Tambien verifica los invariantes nuevos de la seccion 7.9.
 */
import { describe, it, expect } from 'vitest';
import { Dinero } from '../src/dominio/dinero';
import { calcularMoratorioEscalonado } from '../src/dominio/politica-mora/politica-escalonada';
import { calcularMoratorioPlano } from '../src/dominio/politica-mora/politica-plana';
import { calcularMoratorioRetroactivo } from '../src/dominio/politica-mora/politica-retroactiva';

const CAPITAL_MORA = Dinero.deQuetzales('725.76');

// Las tres politicas con la misma firma: (capital, dias) -> Dinero.
type FuncionPolitica = (capital: Dinero, dias: number) => Dinero;

const POLITICAS: Readonly<Record<string, FuncionPolitica>> = {
  plana: calcularMoratorioPlano,
  escalonada: calcularMoratorioEscalonado,
  retroactiva: calcularMoratorioRetroactivo,
};

describe('Contrato comun de las tres politicas (Liskov)', () => {
  it('Ninguna politica acepta dias negativos', () => {
    for (const [nombre, politica] of Object.entries(POLITICAS)) {
      expect(() => politica(CAPITAL_MORA, -1)).toThrow();
    }
  });

  it('Ninguna politica acepta capital negativo', () => {
    const capitalNegativo = Dinero.deQuetzales('-10.00');
    for (const [nombre, politica] of Object.entries(POLITICAS)) {
      expect(() => politica(capitalNegativo, 15)).toThrow();
    }
  });

  it('Con 0 dias o capital cero, todas devuelven cero', () => {
    for (const [nombre, politica] of Object.entries(POLITICAS)) {
      expect(politica(CAPITAL_MORA, 0).esCero()).toBe(true);
      expect(politica(Dinero.cero(), 45).esCero()).toBe(true);
    }
  });

  it('Ninguna politica devuelve mora negativa ni mayor al capital', () => {
    for (const dias of [15, 45, 100, 120]) {
      for (const [nombre, politica] of Object.entries(POLITICAS)) {
        const resultado = politica(CAPITAL_MORA, dias);
        expect(resultado.esNegativo()).toBe(false);
        expect(resultado.esMayorQue(CAPITAL_MORA)).toBe(false);
      }
    }
  });

  it('El moratorio es monotono creciente en todas las politicas', () => {
    for (const [nombre, politica] of Object.entries(POLITICAS)) {
      const a15 = politica(CAPITAL_MORA, 15);
      const a45 = politica(CAPITAL_MORA, 45);
      const a100 = politica(CAPITAL_MORA, 100);
      const a120 = politica(CAPITAL_MORA, 120);
      expect(a45.esMayorQue(a15)).toBe(true);
      expect(a100.esMayorQue(a45)).toBe(true);
      expect(a120.esMayorQue(a100)).toBe(true);
    }
  });
});

describe('Invariantes nuevos (seccion 7.9)', () => {
  it('La escalonada es menor o igual que la retroactiva del tramo actual', () => {
    for (const dias of [31, 45, 61, 75, 91, 100, 120]) {
      const escalonada = calcularMoratorioEscalonado(CAPITAL_MORA, dias);
      const retroactiva = calcularMoratorioRetroactivo(CAPITAL_MORA, dias);
      // La retroactiva nunca da menos que la escalonada.
      expect(escalonada.esMayorQue(retroactiva)).toBe(false);
    }
  });

  it('Entre 1 y 30 dias, la escalonada equivale a una plana al 18%', () => {
    // En el primer tramo, la escalonada usa 18% para todos los dias.
    const a15Escalonada = calcularMoratorioEscalonado(CAPITAL_MORA, 15);
    const a15Plana18 = CAPITAL_MORA.multiplicarPor((0.18 / 360) * 15);
    expect(a15Escalonada.esIgualA(a15Plana18)).toBe(true);
  });

  it('Un credito que pasa a incobrable deja de generar moratorio', () => {
    // La escalonada no devenga en INCOBRABLE (tasa 0): 121 dias da lo mismo que 120.
    const a120 = calcularMoratorioEscalonado(CAPITAL_MORA, 120);
    const a121 = calcularMoratorioEscalonado(CAPITAL_MORA, 121);
    expect(a121.esIgualA(a120)).toBe(true);
  });

  it('El moratorio de una cuota nunca excede su propio capital en mora', () => {
    for (const dias of [15, 45, 100, 120, 200]) {
      const resultado = calcularMoratorioEscalonado(CAPITAL_MORA, dias);
      expect(resultado.esMayorQue(CAPITAL_MORA)).toBe(false);
    }
  });
});