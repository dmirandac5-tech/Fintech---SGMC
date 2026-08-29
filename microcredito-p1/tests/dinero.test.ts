/** Objeto de Valor Dinero (6.2): centavos enteros, inmutable, con moneda. */

import { describe, expect, it } from 'vitest';
import { Dinero } from '../src/dominio/dinero';

describe('Representación exacta del dinero (6.2)', () => {
  it('guarda el importe como entero de centavos, no como punto flotante', () => {
    expect(Dinero.deQuetzales('1004.62').centavosValor()).toBe(100462n);
    expect(typeof Dinero.deQuetzales('1004.62').centavosValor()).toBe('bigint');
  });

  it('no arrastra el error clásico de punto flotante: 0.1 + 0.2 da 0.30', () => {
    // En punto flotante, 0.1 + 0.2 === 0.30000000000000004.
    const suma = Dinero.deQuetzales('0.10').sumar(Dinero.deQuetzales('0.20'));
    expect(suma.toString()).toBe('0.30');
  });

  it('suma cien veces un centavo y da exactamente un quetzal', () => {
    let total = Dinero.cero();
    for (let i = 0; i < 100; i += 1) {
      total = total.sumar(Dinero.deCentavos(1));
    }
    expect(total.toString()).toBe('1.00');
  });

  it('acepta una entrada en texto sin pasar por punto flotante', () => {
    expect(Dinero.deQuetzales('725.76').centavosValor()).toBe(72576n);
    expect(Dinero.deQuetzales('0.5').toString()).toBe('0.50');
    expect(Dinero.deQuetzales('-7.26').centavosValor()).toBe(-726n);
  });

  it('rechaza un texto con formato inválido', () => {
    expect(() => Dinero.deQuetzales('10,000.00')).toThrow(/formato inválido/);
    expect(() => Dinero.deQuetzales('1.234')).toThrow(/formato inválido/);
  });

  it('rechaza construir desde un número de centavos no entero', () => {
    expect(() => Dinero.deCentavos(10.5)).toThrow(/entero de centavos/);
  });
});

describe('Redondeo a 2 decimales, medio hacia arriba (6.2)', () => {
  it.each([
    ['725.76', 0.24 / 360 * 15, '7.26'],
    ['9295.38', 0.03, '278.86'],
    ['10000.00', 0.03, '300.00'],
    ['975.37', 0.03, '29.26'],
    ['1922.32', 0.03, '57.67'],
  ])('%s por %s redondea a %s', (monto, factor, esperado) => {
    expect(Dinero.deQuetzales(monto).multiplicarPor(factor).toString()).toBe(esperado);
  });

  it('la mitad exacta de un centavo sube, no baja', () => {
    // 1.005 tiene que dar 1.01, aunque en binario se represente como 1.00499...
    expect(Dinero.deQuetzales('1.00').multiplicarPor(1.005).toString()).toBe('1.01');
    expect(Dinero.deCentavos(1).multiplicarPor(0.5).toString()).toBe('0.01');
  });

  it('se redondea en cada operación, no al final', () => {
    // Doce cuotas redondeadas por separado no dan lo mismo que redondear la suma:
    // por eso existe el ajuste de la última cuota (6.4).
    const porCuota = Dinero.deQuetzales('9295.38').multiplicarPor(0.03);
    expect(porCuota.toString()).toBe('278.86');
  });
});

describe('Inmutabilidad', () => {
  it('sumar() devuelve un Dinero nuevo y jamás muta el original', () => {
    const original = Dinero.deQuetzales('100.00');
    const resultado = original.sumar(Dinero.deQuetzales('50.00'));
    expect(original.toString()).toBe('100.00');
    expect(resultado.toString()).toBe('150.00');
    expect(resultado).not.toBe(original);
  });

  it('restar() y multiplicarPor() tampoco mutan', () => {
    const original = Dinero.deQuetzales('100.00');
    original.restar(Dinero.deQuetzales('30.00'));
    original.multiplicarPor(2);
    expect(original.toString()).toBe('100.00');
  });
});

describe('Seguridad de moneda', () => {
  it('prohíbe sumar quetzales con dólares', () => {
    const quetzales = Dinero.deQuetzales('100.00', 'GTQ');
    const dolares = Dinero.deQuetzales('100.00', 'USD');
    expect(() => quetzales.sumar(dolares)).toThrow(/monedas distintas/);
    expect(() => quetzales.restar(dolares)).toThrow(/monedas distintas/);
    expect(() => quetzales.esMayorQue(dolares)).toThrow(/monedas distintas/);
  });

  it('dos importes iguales en monedas distintas no son iguales', () => {
    expect(
      Dinero.deQuetzales('100.00', 'GTQ').esIgualA(Dinero.deQuetzales('100.00', 'USD')),
    ).toBe(false);
  });
});

describe('Comparación y utilidades', () => {
  it('minimo() devuelve el menor: es lo que consume cada eslabón de la prelación', () => {
    const remanente = Dinero.deQuetzales('500.00');
    const adeudado = Dinero.deQuetzales('725.76');
    expect(remanente.minimo(adeudado).toString()).toBe('500.00');
    expect(adeudado.minimo(remanente).toString()).toBe('500.00');
  });

  it('dividirEntre() reparte truncando hacia abajo', () => {
    expect(Dinero.deQuetzales('1000.00').dividirEntre(3).toString()).toBe('333.33');
    expect(() => Dinero.deQuetzales('100.00').dividirEntre(0)).toThrow(/entero positivo/);
  });

  it('formatea con separadores de miles para presentación', () => {
    expect(Dinero.deQuetzales('1004.62').toStringConMoneda()).toBe('Q1,004.62');
    expect(Dinero.deQuetzales('800000.00').toStringConMoneda()).toBe('Q800,000.00');
  });
});
