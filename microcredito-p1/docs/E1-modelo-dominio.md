# E1 · Modelo del dominio en UML

**Sistema de Gestión de Microcrédito — Crédito Vecino, S. A.**
Proyecto 1 · Análisis de Sistemas II (037) · UMG · 2026

Todos los diagramas de este entregable están en `docs/diagramas/*.puml`, en formato PlantUML editable
(se pueden abrir con la extensión de VS Code "PlantUML", con [plantuml.com/plantuml](https://www.plantuml.com/plantuml)
o con `npx node-plantuml`). Aquí se explica cada uno y se conecta con la sección del enunciado que modela.

## 1. Diagrama de casos de uso

Archivo: [`diagramas/casos-de-uso.puml`](diagramas/casos-de-uso.puml)

Actores:

| Actor | Rol |
|---|---|
| Cliente | Solicita el crédito y realiza pagos |
| Asesor de crédito | Registra clientes, solicitudes, desembolsos y pagos |
| Comité de crédito | Aprueba/rechaza solicitudes y autoriza reestructuraciones |
| Casa de cobro (externa) | Gestiona la recuperación de créditos incobrables (6.7) |
| Gerencia | Consulta indicadores de cartera en riesgo (6.8) |
| Reloj / Programador de cierres | Actor de sistema que dispara los cierres diario y mensual (6.9) |

Los casos de uso cubren exactamente los que pide el enunciado (Registrar cliente, Solicitar crédito,
Evaluar/aprobar, Desembolsar, Registrar pago, Generar cierre, Consultar cartera en riesgo), más los que
se derivan de las reglas de negocio (Calcular mora, Reestructurar crédito, Declarar incobrable), que el
enunciado exige como reglas aunque no los liste explícitamente como casos de uso principales.

## 2. Diagrama de clases

Archivo: [`diagramas/clases.puml`](diagramas/clases.puml)

Incluye las nueve clases que pide el enunciado (Cliente, SolicitudCredito, Credito, PlanAmortizacion,
Cuota, Pago, Movimiento, Cierre, Dinero) más las clases de apoyo que las reglas de negocio exigen:

- `PoliticaCredito`: representa las tasas y tramos como *parámetros versionados* (sección 6.1 y 6.3.1),
  nunca constantes en el código. Es la base del patrón Strategy.
- `AplicacionPago`: Value Object que registra a qué rubro (gastos/moratorio/corriente/capital) se
  aplicó cada porción de un pago — necesario para poder demostrar "a qué corresponde cada cargo" (6.3.1).
- `HistorialEstadoCredito`: cumple la regla de trazabilidad de la sección 6.7 ("todo cambio de estado
  se registra con fecha, usuario/proceso y motivo... el historial nunca se borra").
- `TramoMora` aparece como *enum*, no como clase con ciclo de vida propio: es una clasificación
  derivada (ver estados-credito.puml), no un estado.

## 3. Diagramas de secuencia

### 3.1 Registrar pago de cuota (obligatorio — muestra la prelación de 6.6)
Archivo: [`diagramas/secuencia-registrar-pago.puml`](diagramas/secuencia-registrar-pago.puml)

Muestra el flujo completo: verificación de idempotencia, cálculo de días de atraso vía el puerto Reloj,
cálculo del interés moratorio sobre el capital en mora (nunca sobre la cuota completa), y la aplicación
del pago a través de la cadena de responsabilidad (gastos → moratorio → corriente → capital). También
representa el guardado como transición inválida imposible por diseño (un crédito que no puede recibir
pagos nunca llega a la cadena).

### 3.2 Desembolsar crédito (construcción del plan de amortización)
Archivo: [`diagramas/secuencia-desembolsar-credito.puml`](diagramas/secuencia-desembolsar-credito.puml)

Muestra el patrón Factory/Builder construyendo el `PlanAmortizacion`: el cálculo período a período, el
ajuste obligatorio de la última cuota, y la verificación del invariante Σ amortización = capital.

## 4. Diagrama de estados

Archivo: [`diagramas/estados-credito.puml`](diagramas/estados-credito.puml)

Cubre las 16 filas de la tabla 6.7.1, incluidas explícitamente las transiciones de regularización:

- `en_mora → vigente` (paga todo lo vencido)
- `en_mora (Vencido) → en_mora` (baja de tramo, paga parte)
- `reestructurado → en_mora` (se atrasa en el nuevo plan)
- `reestructurado → vigente` (cumple el nuevo plan)
- `incobrable → incobrable` (recuperación vía casa de cobro, sin regresar a cartera)

El estado `en_mora` es único; los tramos (Mora 1 a Vencido) NO se modelan como estados aparte —eso
obligaría a transiciones entre todos los pares de tramos, en ambos sentidos, y el diagrama se volvería
inmanejable, exactamente el error que el enunciado señala explícitamente en 6.7.1—. En cambio, el tramo
se calcula desde `díasDeAtraso` cada vez que se necesita (patrón Specification), sin depender de un
historial de transiciones propio. Esa aclaración queda documentada como nota dentro del propio diagrama
de estados (`estados-credito.puml`), sin un diagrama separado.

## 5. Diagrama de actividades

Archivo: [`diagramas/actividad-cierre-mensual.puml`](diagramas/actividad-cierre-mensual.puml)

Elegido el cierre mensual porque es el que ejercita todas las reglas de la sección 6.8 y 6.9:
idempotencia (no duplica movimientos si se reejecuta el mismo día), reclasificación de tramos, cálculo
de cartera en riesgo, marcación de incobrables y — la regla que el enunciado remarca como "la trampa" —
reportar el porcentaje de cartera en riesgo junto con el monto dado por incobrable en el período, para
que declarar incobrables no "mejore" el indicador de forma engañosa.

La nota del diagrama documenta que el cierre diario comparte el mismo esqueleto (Template Method) sin
las particiones de cartera en riesgo y deterioro, que son exclusivas del mensual.

## 6. Matriz de trazabilidad (requisito → caso de uso → clase/módulo)

| Req. | Descripción | Caso de uso | Clase / módulo |
|---|---|---|---|
| R1 | Registrar y consultar clientes | Registrar cliente | `Cliente` |
| R2 | Otorgar créditos con plan de cuotas (amortización francesa, ajuste de última cuota) | Solicitar / Desembolsar crédito | `Credito`, `PlanAmortizacion`, `Cuota`, `PlanAmortizacionFactory` |
| R3 | Registrar pagos aplicando la prelación (gastos → moratorio → corriente → capital) | Registrar pago de cuota | `Pago`, `AplicacionPago`, `PrelacionPago` (Chain of Responsibility) |
| R4 | Calcular interés moratorio solo sobre capital en mora (prohibición de anatocismo) | Calcular mora | `CalculadoraMora` |
| R5 | Clasificar el tramo de mora de forma derivada y reversible | Calcular mora / Generar cierre | `CalculadoraMora`, `TramoMora` (Specification) |
| R6 | Representar dinero sin error de punto flotante, inmutable | (transversal a todos) | `Dinero` (Value Object) |
| R7 | Versionar tasas y tramos como política, no como constantes | Solicitar / Desembolsar crédito | `PoliticaCredito` (Strategy) |
| R8 | Reestructurar créditos sin perder el historial de riesgo | Reestructurar crédito | `Credito`, `HistorialEstadoCredito` |
| R9 | Declarar incobrable y tercerizar la gestión de cobro | Declarar incobrable | `Credito`, `Movimiento` (`CASTIGO_INCOBRABLE` / `RECUPERACION_INCOBRABLE`) |
| R10 | Reportar cierres y cartera en riesgo junto con lo dado por incobrable | Generar cierre / Consultar cartera en riesgo | `Cierre`, `CarteraRiesgo` |
| R11 | Garantizar idempotencia en pagos y en cierres | Registrar pago / Generar cierre | `Pago.claveIdempotencia`, `Cierre.fechaCorte` |

## 7. Consistencia con E4 (núcleo ejecutable)

Este modelo es deliberadamente el mismo que se implementará en `src/dominio/` (E4): `Dinero`,
`PlanAmortizacion`/`Cuota` (→ `plan-amortizacion.ts`), `CalculadoraMora` (→ `calculadora-mora.ts`),
`AplicacionPago`/prelación (→ `prelacion-pago.ts`) y `Cierre`/`TramoMora` (→ `cartera.ts`). Ninguna clase
del diagrama depende de infraestructura (sin `Repositorio` concreto, sin fechas del sistema leídas
directamente) — el acceso a datos y al reloj se hace siempre a través de los puertos secundarios de la
arquitectura hexagonal (ver E2).
