/** Mora, interés moratorio y clasificación por tramos (6.5, 6.7.1). */

import { describe, expect, it } from 'vitest';
import { Dinero } from '../src/dominio/dinero';
import {
  calcularDiasAtraso,
  calcularInteresMoratorio,
  calcularInteresMoratorioTotal,
  clasificarTramoMora,
  debeSuspenderDevengo,
} from '../src/dominio/calculadora-mora';
import { crearPoliticaCredito, tasaMoratoriaDiaria } from '../src/dominio/politica-credito';
import { POLITICA_2026 } from './fixtures';

describe('Interés moratorio de la cuota 2 (6.5)', () => {
  it('la tasa moratoria diaria es 24% / 360', () => {
    expect(tasaMoratoriaDiaria(POLITICA_2026)).toBeCloseTo(0.24 / 360, 12);
  });

  it('produce Q7.26 sobre Q725.76 a 15 días', () => {
    const capitalEnMora = Dinero.deQuetzales('725.76');
    const moratorio = calcularInteresMoratorio(capitalEnMora, POLITICA_2026, 15);
    expect(moratorio.toString()).toBe('7.26');
  });

  it('se calcula sobre el capital en mora, no sobre el total de la cuota', () => {
    // Sobre la cuota completa (que incluye Q278.86 de interés) daría otra cifra.
    const sobreCapital = calcularInteresMoratorio(Dinero.deQuetzales('725.76'), POLITICA_2026, 15);
    const sobreCuotaCompleta = calcularInteresMoratorio(
      Dinero.deQuetzales('1004.62'),
      POLITICA_2026,
      15,
    );
    expect(sobreCapital.toString()).toBe('7.26');
    expect(sobreCuotaCompleta.toString()).not.toBe(sobreCapital.toString());
  });
});

describe('Cálculo del interés moratorio', () => {
  it('es cero si no hay días de atraso', () => {
    expect(calcularInteresMoratorio(Dinero.deQuetzales('725.76'), POLITICA_2026, 0).toString()).toBe(
      '0.00',
    );
  });

  it('es cero si no hay capital en mora', () => {
    expect(calcularInteresMoratorio(Dinero.cero(), POLITICA_2026, 30).toString()).toBe('0.00');
  });

  it('rechaza días de atraso negativos', () => {
    expect(() => calcularInteresMoratorio(Dinero.deQuetzales('100.00'), POLITICA_2026, -1)).toThrow(
      /no pueden ser negativos/,
    );
  });

  it('cada cuota vencida genera su propio moratorio, no uno sobre la suma', () => {
    const cuotas = [
      { numero: 1, capitalEnMora: Dinero.deQuetzales('704.62'), diasAtraso: 45 },
      { numero: 2, capitalEnMora: Dinero.deQuetzales('725.76'), diasAtraso: 15 },
    ];
    const porCuota = calcularInteresMoratorioTotal(cuotas, POLITICA_2026);
    const individual = cuotas
      .map((c) => calcularInteresMoratorio(c.capitalEnMora, POLITICA_2026, c.diasAtraso))
      .reduce((a, b) => a.sumar(b), Dinero.cero());
    expect(porCuota.toString()).toBe(individual.toString());

    // Un cálculo único sobre la suma de capitales y el atraso mayor da otra cifra.
    const sobreLaSuma = calcularInteresMoratorio(
      Dinero.deQuetzales('704.62').sumar(Dinero.deQuetzales('725.76')),
      POLITICA_2026,
      45,
    );
    expect(sobreLaSuma.toString()).not.toBe(porCuota.toString());
  });

  it('la base de conteo cambia el resultado (Actual/360 vs Actual/365)', () => {
    const base365 = crearPoliticaCredito({ ...POLITICA_2026, id: 'POL-365', baseConteo: 'ACTUAL_365' });
    const capital = Dinero.deQuetzales('725.76');
    expect(calcularInteresMoratorio(capital, POLITICA_2026, 15).toString()).toBe('7.26');
    expect(calcularInteresMoratorio(capital, base365, 15).toString()).toBe('7.16');
  });
});

describe('Días de atraso (días calendario)', () => {
  it('cuenta 15 días entre el vencimiento y la fecha de corte', () => {
    expect(
      calcularDiasAtraso(new Date(Date.UTC(2026, 2, 15)), new Date(Date.UTC(2026, 2, 30))),
    ).toBe(15);
  });

  it('una cuota que aún no vence tiene 0 días de atraso, nunca negativos', () => {
    expect(
      calcularDiasAtraso(new Date(Date.UTC(2026, 3, 15)), new Date(Date.UTC(2026, 2, 30))),
    ).toBe(0);
  });
});

describe('Specification: clasificación por tramos (6.7.1)', () => {
  it.each([
    [0, 'AL_DIA'],
    [1, 'MORA_1'],
    [8, 'MORA_1'],
    [10, 'MORA_1'],
    [30, 'MORA_1'],
    [31, 'MORA_2'],
    [45, 'MORA_2'],
    [60, 'MORA_2'],
    [61, 'MORA_3'],
    [75, 'MORA_3'],
    [90, 'MORA_3'],
    [91, 'VENCIDO'],
    [100, 'VENCIDO'],
    [120, 'VENCIDO'],
    [121, 'INCOBRABLE'],
    [210, 'INCOBRABLE'],
  ])('con %i días de atraso clasifica en %s', (dias, tramo) => {
    expect(clasificarTramoMora(dias)).toBe(tramo);
  });

  it('el tramo baja cuando bajan los días de atraso', () => {
    // Caso del enunciado: 45 días es Mora 2; con un pago que lo deja en 10, Mora 1.
    expect(clasificarTramoMora(45)).toBe('MORA_2');
    expect(clasificarTramoMora(10)).toBe('MORA_1');
    expect(clasificarTramoMora(0)).toBe('AL_DIA');
  });

  it('rechaza días de atraso negativos', () => {
    expect(() => clasificarTramoMora(-5)).toThrow(/no pueden ser negativos/);
  });
});

describe('Interés en suspenso (6.5)', () => {
  it('se suspende el devengo al superar los 90 días', () => {
    expect(debeSuspenderDevengo(90)).toBe(false);
    expect(debeSuspenderDevengo(91)).toBe(true);
  });

  it('se reactiva si el crédito se regulariza', () => {
    expect(debeSuspenderDevengo(0)).toBe(false);
  });
});
