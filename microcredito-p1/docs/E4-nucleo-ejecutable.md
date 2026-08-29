# E4 · Núcleo de cálculo ejecutable (walking skeleton)

**Sistema de Gestión de Microcrédito — Crédito Vecino, S. A.**
Proyecto 1 · Análisis de Sistemas II (037) · UMG · 2026

## 1. Cómo ejecutarlo

Desde un clon limpio, sin base de datos ni servidor:

```bash
npm install && npm test
```

`npm test` ejecuta primero `tsc --noEmit` (el compilador en modo `strict` es la primera prueba) y
después la suite completa con Vitest.


Para imprimir las tablas de los casos de referencia en consola: `npm run reporte`.

## 2. Correspondencia E3 → E4 (es el mismo diseño, no otro)

Cada archivo del núcleo implementa exactamente la pieza que E3 documentó:

| Archivo `src/dominio/` | Pieza de E3 | Patrón que realiza |
|---|---|---|
| `dinero.ts` | Objeto de Valor `Dinero` | Value Object — inmutable, `bigint` de centavos, moneda tipada |
| `plan-amortizacion.ts` | `PlanAmortizacion`, `Cuota`, motor de cálculo | Strategy (GoF) en `EstrategiaAmortizacion` + Builder (GoF) en `construirPlanAmortizacion` |
| `calculadora-mora.ts` | `CalculadoraMora`, `TramoMora` | Specification — la clasificación por tramos es función pura del dato vigente |
| `prelacion-pago.ts` | `PrelacionPago` | Chain of Responsibility (GoF) — cuatro eslabones enlazados |
| `estado-credito.ts` | Ciclo de vida del crédito | State (GoF) — un objeto por estado; las transiciones inválidas son imposibles |
| `politica-credito.ts` | `PoliticaCredito` | Parámetros versionados (tasas, base de conteo, política de adelanto) |
| `movimiento.ts` | `Movimiento` | Mayor append-only: el saldo se acumula, nunca se sobrescribe |
| `credito.ts` | `Credito` (raíz del agregado) | Coordina las piezas anteriores sin duplicar sus reglas |
| `reloj.ts` | Puerto secundario `Reloj` | Interfaz + reloj fijo, para que la mora sea reproducible |

Patrones exigidos: 4, de los cuales 3 son GoF (Strategy, Chain of Responsibility, State), más el
Value Object y el Builder. Supera el mínimo de la sección 9 (cuatro patrones, dos GoF).

## 3. Pruebas obligatorias del enunciado — estado

| # | Prueba obligatoria | Dónde | Estado |
|---|---|---|---|
| 1 | Reproducir las **12 filas exactas** de la tabla 6.4.1 | `plan-amortizacion.test.ts` | Listo |
| 2 | Cuota 12 = **Q1,004.63** (ajuste de cuadre) | `plan-amortizacion.test.ts` | Listo |
| 3 | Invariante Σ amortizaciones = capital exacto | `plan-amortizacion.test.ts` | Listo |
| 4 | Invariante saldo final = **Q0.00 exacto** | `plan-amortizacion.test.ts` | Listo |
| 5 | Interés moratorio = **Q7.26** (6.5) | `calculadora-mora.test.ts` | Listo |
| 6 | Cartera en riesgo = **7.00 %** (6.8.1) | `cartera.test.ts` | Listo |
| 7 | Tras dar por incobrable C-005 = **6.06 %** | `cartera.test.ts` | Listo |
| 8 | Reversibilidad: 45 días → Mora 2; baja de tramo al pagar | `credito-estado.test.ts` | Listo |
| 9 | Regularización: paga todo lo vencido → VIGENTE | `credito-estado.test.ts` | Listo |
| 10 | Transición inválida (pagar un crédito SOLICITADO) rechazada por diseño | `credito-estado.test.ts` | Listo |
| 11 | Idempotencia: el mismo pago dos veces no altera el saldo | `credito-estado.test.ts` | Listo |

Además se cubren los tres escenarios de pago de 6.6 (exacto Q1,011.88, parcial Q500.00 con Q511.88 de
capital pendiente, y excedente Q1,988.12), tanto a nivel de la cadena de prelación como sobre el agregado.

## 4. Decisiones de implementación que conviene poder defender

### Por qué `bigint` y no `decimal.js`

El enunciado permite ambas. Se eligió entero de centavos en `bigint` porque hace la regla verificable
a simple vista (no existe ningún `number` que guarde un importe) y porque deja el proyecto con cero
dependencias de producción, de modo que `npm install && npm test` corre en limpio sin arrastrar nada.

### Cómo se multiplica un importe por una tasa sin punto flotante

La tasa se escala a entero con 12 decimales, el producto se hace en aritmética exacta de `bigint`, y
solo al final se divide redondeando medio hacia arriba. Se verificó que las tasas del caso de
referencia caen en enteros exactos: `0.36/12` da 3 % exacto, y `(0.24/360)·15` da 1 % exacto.

### Por qué el redondeo lleva un epsilon

`725.76 × 100` se representa en binario como `72575.99999999999`. Sin la corrección, el redondeo medio
hacia arriba del enunciado fallaría por un centavo justo en los casos que la rúbrica revisa.

### Por qué la última cuota se ajusta en el Builder y no en quien lo llama

El invariante (suma de amortizaciones = capital, saldo final = 0.00) se verifica dentro de
`construirPlanAmortizacion` antes de devolver el plan. No es posible obtener un `PlanAmortizacion` que
lo incumpla.

### Por qué los tramos de mora no son estados

`clasificarTramoMora` es una función pura de los días de atraso vigentes. Por eso se mueve en ambas
direcciones sin necesidad de transiciones inversas entre tramos, que es el error que la sección 6.7.1
advierte.

### Nota sobre el caso "45 días a 10 días" del enunciado

Con cuotas mensuales, dos vencimientos consecutivos distan 28 a 31 días, de modo que un atraso de 45
días en la cuota más antigua deja el siguiente vencimiento en 14 a 17 días, nunca en 10 exactos. Por
eso la reversibilidad se prueba en dos niveles: la regla pura (`clasificarTramoMora(45)` da MORA_2 y
`clasificarTramoMora(10)` da MORA_1, con los números literales del enunciado) y el comportamiento del
agregado (45 días, paga, quedan 17 días, baja a MORA_1 y sigue en mora; paga el resto y regulariza).

### Política de adelanto elegida (6.6.5)

Amortización directa a capital, aplicada desde las últimas cuotas hacia atrás, es decir reducción de
plazo. Al quedar una cuota completamente prepagada se cancela también su interés corriente, porque el
interés se devenga con el tiempo y esos meses ya no transcurrirán. El excedente nunca se pierde: si
sobra después de cancelar todo el capital, queda registrado como saldo a favor del cliente.

## 5. Restricciones de alcance, verificadas automáticamente

`tests/restricciones-alcance.test.ts` hace cumplir con pruebas lo que la rúbrica penaliza:

- ningún archivo del dominio contiene `any`;
- ningún archivo del dominio importa `express`, `pg`, `prisma`, `react`, el SDK de MCP, LangChain ni
  módulos de sistema operativo;
- el dominio solo importa de sí mismo (cero dependencias hacia afuera);
- el `package.json` no declara ninguna dependencia de producción;
- ningún archivo del dominio llama a `new Date()` ni a `Date.now()`: la fecha de corte siempre llega
  como parámetro, de modo que una prueba que pasa hoy pasa también dentro de un año;
- `tsconfig.json` tiene `strict: true` (y además `noUncheckedIndexedAccess`).

## 6. Estructura entregada

```
microcredito-p1/
├── package.json          scripts: test (tsc --noEmit && vitest run)
├── tsconfig.json         strict: true
├── src/dominio/          núcleo puro, sin infraestructura
│   ├── dinero.ts
│   ├── plan-amortizacion.ts
│   ├── calculadora-mora.ts
│   ├── prelacion-pago.ts
│   ├── cartera.ts
│   ├── credito.ts
│   ├── estado-credito.ts
│   ├── politica-credito.ts
│   ├── movimiento.ts
│   └── reloj.ts
└── tests/
    ├── fixtures.ts                  datos del caso de referencia
    ├── dinero.test.ts
    ├── plan-amortizacion.test.ts    caso 6.4.1
    ├── calculadora-mora.test.ts     caso 6.5
    ├── prelacion-pago.test.ts       escenarios 6.6.3 a 6.6.5
    ├── cartera.test.ts              casos 6.8.1
    ├── credito-estado.test.ts       ciclo de vida 6.7
    ├── restricciones-alcance.test.ts pruebas de arquitectura
    └── reporte-casos-referencia.test.ts  imprime los casos de referencia
```
