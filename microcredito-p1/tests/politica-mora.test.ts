/**
 * Pruebas de la politica de mora escalonada (E6, seccion 7).
 * Reproduce los casos M-1 a M-5 y la coexistencia de politicas CP-03.
 * Base Actual/360, capital en mora Q725.76, interes corriente Q278.86.
 */
import { describe, it, expect } from 'vitest';
import { Dinero } from '../src/dominio/dinero';
import { calcularMoratorioEscalonado } from '../src/dominio/politica-mora/politica-escalonada';
import { calcularMoratorioPlano } from '../src/dominio/politica-mora/politica-plana';
import { calcularMoratorioRetroactivo } from '../src/dominio/politica-mora/politica-retroactiva';
import { calcularMoratorioPorPolitica } from '../src/dominio/politica-mora/catalogo-politicas';
import { gastoGestionCobro, MONTO_GASTO_GESTION } from '../src/dominio/politica-mora/gasto-gestion-cobro';

const CAPITAL_MORA = Dinero.deQuetzales('725.76');
const INTERES_CORRIENTE = Dinero.deQuetzales('278.86');

describe('Politica de mora escalonada - casos M del enunciado', () => {
  it('M-1: 15 dias (solo Mora 1) da Q5.44', () => {
    const resultado = calcularMoratorioEscalonado(CAPITAL_MORA, 15);
    expect(resultado.toString()).toBe('5.44');
  });

  it('M-2: 45 dias (Mora 1 + Mora 2) da Q18.14, no Q18.15', () => {
    const resultado = calcularMoratorioEscalonado(CAPITAL_MORA, 45);
    expect(resultado.toString()).toBe('18.14');
  });

  it('M-3: 100 dias (cuatro tramos) da Q50.80', () => {
    const resultado = calcularMoratorioEscalonado(CAPITAL_MORA, 100);
    expect(resultado.toString()).toBe('50.80');
  });

  it('M-4: 120 dias (frontera con incobrable) da Q65.32', () => {
    const resultado = calcularMoratorioEscalonado(CAPITAL_MORA, 120);
    expect(resultado.toString()).toBe('65.32');
  });

  it('M-5: total adeudado cuota 2 a 45 dias con gasto da Q1047.76', () => {
    const mora = calcularMoratorioEscalonado(CAPITAL_MORA, 45);
    const gasto = gastoGestionCobro('GTQ', 45);
    const total = gasto.sumar(mora).sumar(INTERES_CORRIENTE).sumar(CAPITAL_MORA);
    expect(total.toString()).toBe('1047.76');
  });
});

describe('Coexistencia de politicas (CP-03)', () => {
  const FECHA_ANTES = new Date(Date.UTC(2026, 8, 15)); // 15 de agosto de 2026
  const FECHA_DESPUES = new Date(Date.UTC(2026, 9, 10)); // 10 de octubre de 2026

  it('Credito otorgado antes del 1 oct 2026 usa politica plana: Q21.77', () => {
    const resultado = calcularMoratorioPorPolitica(CAPITAL_MORA, 45, FECHA_ANTES);
    expect(resultado.toString()).toBe('21.77');
  });

  it('Credito otorgado despues del 1 oct 2026 usa politica escalonada: Q18.14', () => {
    const resultado = calcularMoratorioPorPolitica(CAPITAL_MORA, 45, FECHA_DESPUES);
    expect(resultado.toString()).toBe('18.14');
  });

  it('La politica plana reproduce el Q7.26 del P1 a 15 dias', () => {
    const resultado = calcularMoratorioPlano(CAPITAL_MORA, 15);
    expect(resultado.toString()).toBe('7.26');
  });
});

describe('Sustituibilidad de Liskov - misma bateria contra las tres politicas', () => {
  it('Las tres politicas aceptan los mismos casos sin romper invariantes', () => {
    const casos = [15, 45, 100, 120];
    for (const dias of casos) {
      const escalonada = calcularMoratorioEscalonado(CAPITAL_MORA, dias);
      const plana = calcularMoratorioPlano(CAPITAL_MORA, dias);
      const retroactiva = calcularMoratorioRetroactivo(CAPITAL_MORA, dias);
      // Ninguna devuelve negativo ni excede el capital en mora.
      expect(escalonada.esNegativo()).toBe(false);
      expect(plana.esNegativo()).toBe(false);
      expect(retroactiva.esNegativo()).toBe(false);
      expect(escalonada.esMayorQue(CAPITAL_MORA)).toBe(false);
    }
  });

  it('La retroactiva da Q72.58 a 100 dias (contraste del enunciado, NO adoptada)', () => {
    const resultado = calcularMoratorioRetroactivo(CAPITAL_MORA, 100);
    expect(resultado.toString()).toBe('72.58');
  });
});

describe('Gasto de gestion de cobro (CP-02)', () => {
  it('No genera gasto con menos de 31 dias (Mora 1)', () => {
    const gasto = gastoGestionCobro('GTQ', 15);
    expect(gasto.esCero()).toBe(true);
  });

  it('Genera Q25.00 al alcanzar 31 dias (entrada a Mora 2)', () => {
    const gasto = gastoGestionCobro('GTQ', 31);
    expect(gasto.toString()).toBe('25.00');
  });

  it('El monto es exactamente MONTO_GASTO_GESTION', () => {
    expect(MONTO_GASTO_GESTION).toBe(25.0);
  });
});