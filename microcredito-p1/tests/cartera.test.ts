/** Cartera en riesgo (6.8): caso de referencia 6.8.1 y efecto del castigo. */

import { describe, expect, it } from 'vitest';
import { Dinero } from '../src/dominio/dinero';
import {
  calcularCarteraEnRiesgo,
  generarReporteCarteraEnRiesgo,
  porcentajeCarteraEnRiesgo,
  type CreditoEnCartera,
} from '../src/dominio/cartera';

function credito(
  id: string,
  saldo: string,
  diasAtraso: number,
  reestructurado = false,
  incobrable = false,
): CreditoEnCartera {
  return {
    id,
    saldoCapital: Dinero.deQuetzales(saldo),
    diasAtraso,
    reestructurado,
    incobrable,
  };
}

/** La cartera de siete créditos de la tabla 6.8.1. */
const CARTERA_REFERENCIA: readonly CreditoEnCartera[] = [
  credito('C-001', '620000.00', 0),
  credito('C-002', '124000.00', 8),
  credito('C-003', '24000.00', 45),
  credito('C-004', '18000.00', 75),
  credito('C-005', '8000.00', 100),
  credito('C-006', '6000.00', 0, true),
  credito('C-007', '15000.00', 210, false, true),
];

describe('Caso de referencia 6.8.1', () => {
  const resultado = calcularCarteraEnRiesgo(CARTERA_REFERENCIA);

  it('la cartera activa es Q800,000.00; el incobrable C-007 no entra', () => {
    expect(resultado.carteraActiva.toString()).toBe('800000.00');
  });

  it('el monto en riesgo es Q56,000.00', () => {
    expect(resultado.carteraEnRiesgo.toString()).toBe('56000.00');
  });

  it('la cartera en riesgo es 7.00 %', () => {
    expect(porcentajeCarteraEnRiesgo(resultado)).toBe(7.0);
    expect(resultado.proporcion).toBeCloseTo(0.07, 10);
  });

  it.each([
    ['C-001', false, 'al día'],
    ['C-002', false, '8 días no superan el umbral de 30'],
    ['C-003', true, '45 días'],
    ['C-004', true, '75 días'],
    ['C-005', true, '100 días'],
    ['C-006', true, 'al día PERO reestructurado'],
    ['C-007', false, 'incobrable: excluido'],
  ])('clasifica %s como enRiesgo=%s (%s)', (id, esperado) => {
    const detalle = resultado.detalle.find((d) => d.id === id);
    expect(detalle?.enRiesgo).toBe(esperado);
  });

  it('C-002 con 8 días de atraso no entra: no supera los 30 días', () => {
    const detalle = resultado.detalle.find((d) => d.id === 'C-002');
    expect(detalle?.tramo).toBe('MORA_1');
    expect(detalle?.enRiesgo).toBe(false);
  });

  it('C-006 está al día pero reestructurado: sí entra', () => {
    const detalle = resultado.detalle.find((d) => d.id === 'C-006');
    expect(detalle?.tramo).toBe('AL_DIA');
    expect(detalle?.enRiesgo).toBe(true);
  });

  it('C-007 queda excluido de la base, no solo del numerador', () => {
    const detalle = resultado.detalle.find((d) => d.id === 'C-007');
    expect(detalle?.excluido).toBe(true);
    // 620,000 + 124,000 + 24,000 + 18,000 + 8,000 + 6,000 = 800,000 (sin los 15,000)
    expect(resultado.carteraActiva.toString()).toBe('800000.00');
  });
});

describe('La trampa de dar por incobrable (6.8)', () => {
  /** Se declara incobrable C-005 (Q8,000.00, 100 días de atraso). */
  const CARTERA_TRAS_CASTIGO: readonly CreditoEnCartera[] = CARTERA_REFERENCIA.map((c) =>
    c.id === 'C-005' ? { ...c, incobrable: true } : c,
  );
  const resultado = calcularCarteraEnRiesgo(CARTERA_TRAS_CASTIGO);

  it('el monto en riesgo baja a Q48,000.00 y la cartera activa a Q792,000.00', () => {
    expect(resultado.carteraEnRiesgo.toString()).toBe('48000.00');
    expect(resultado.carteraActiva.toString()).toBe('792000.00');
  });

  it('el indicador "mejora" a 6.06 % sin haber cobrado un solo quetzal', () => {
    expect(porcentajeCarteraEnRiesgo(resultado)).toBe(6.06);
  });

  it('el reporte exige acompañar el porcentaje con lo dado por incobrable', () => {
    const castigado = CARTERA_REFERENCIA.filter((c) => c.id === 'C-005');
    const reporte = generarReporteCarteraEnRiesgo(CARTERA_TRAS_CASTIGO, castigado);
    expect(reporte.porcentaje).toBe(6.06);
    expect(reporte.dadoPorIncobrableEnElPeriodo.toString()).toBe('8000.00');
  });
});

describe('Invariantes de la cartera (6.10)', () => {
  it('la proporción siempre está entre 0 y 1', () => {
    const resultado = calcularCarteraEnRiesgo(CARTERA_REFERENCIA);
    expect(resultado.proporcion).toBeGreaterThanOrEqual(0);
    expect(resultado.proporcion).toBeLessThanOrEqual(1);
  });

  it('una cartera vacía da 0 % y no divide entre cero', () => {
    const resultado = calcularCarteraEnRiesgo([]);
    expect(resultado.carteraActiva.toString()).toBe('0.00');
    expect(porcentajeCarteraEnRiesgo(resultado)).toBe(0);
  });

  it('una cartera enteramente en mora da 100 %', () => {
    const resultado = calcularCarteraEnRiesgo([credito('X-1', '1000.00', 60)]);
    expect(porcentajeCarteraEnRiesgo(resultado)).toBe(100);
    expect(resultado.proporcion).toBe(1);
  });

  it('el umbral es "más de 30 días": 30 no entra, 31 sí', () => {
    expect(porcentajeCarteraEnRiesgo(calcularCarteraEnRiesgo([credito('X', '1000.00', 30)]))).toBe(0);
    expect(porcentajeCarteraEnRiesgo(calcularCarteraEnRiesgo([credito('X', '1000.00', 31)]))).toBe(
      100,
    );
  });

  it('se cuenta el saldo de capital completo, no solo la cuota vencida', () => {
    // Un solo crédito de Q24,000.00 con 45 días aporta sus Q24,000.00 enteros.
    const resultado = calcularCarteraEnRiesgo([credito('C-003', '24000.00', 45)]);
    expect(resultado.carteraEnRiesgo.toString()).toBe('24000.00');
  });
});
