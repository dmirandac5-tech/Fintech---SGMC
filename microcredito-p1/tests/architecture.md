# Descripción de la Arquitectura

## 1. Descripción general

El Sistema de Gestión de Microcréditos está organizado alrededor de una arquitectura centrada en el dominio.

La implementación actual se enfoca en el núcleo ejecutable del dominio desarrollado durante el entregable E4. El objetivo principal es encapsular las reglas financieras del sistema de microcréditos en un conjunto de módulos cohesivos de TypeScript, manteniendo la lógica de negocio independiente de aspectos de infraestructura.

La implementación de E4 no incluye una base de datos, servicios externos, configuración de Docker, variables de entorno ni un servidor web. El núcleo del dominio puede ejecutarse y probarse de manera independiente.

Este alcance es intencional, ya que permite validar primero las reglas financieras antes de incorporar componentes de infraestructura.

---

## 2. Enfoque arquitectónico

El proyecto utiliza un enfoque orientado al dominio, donde las reglas de negocio más importantes se concentran dentro de la capa de dominio.

La arquitectura actual puede representarse de la siguiente manera:

```text
                    ┌───────────────────────────┐
                    │     Capa externa          │
                    │    API / UI / Persistencia │
                    │       Alcance futuro      │
                    └─────────────┬─────────────┘
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │    Capa de aplicación     │
                    │       Alcance futuro      │
                    └─────────────┬─────────────┘
                                  │
                                  ▼
        ┌──────────────────────────────────────────────────┐
        │                  CAPA DE DOMINIO                 │
        │                                                  │
        │  ┌──────────┐     ┌──────────────────────────┐  │
        │  │  Dinero  │     │        Crédito           │  │
        │  └──────────┘     └────────────┬─────────────┘  │
        │                                │                │
        │       ┌────────────────────────┼───────────┐    │
        │       │                        │           │    │
        │       ▼                        ▼           ▼    │
        │  Amortización              Estados      Movimientos
        │       │                        │                │
        │       ▼                        ▼                │
        │  Estrategias             Patrón State           │
        │                                                  │
        │  Mora ── Prelación ── Cartera ── Política      │
        │                                                  │
        └──────────────────────────────────────────────────┘

##Estructura del proyecto

microcredito-p1/
├── src/
│   └── dominio/
│       ├── dinero.ts
│       ├── plan-amortizacion.ts
│       ├── calculadora-mora.ts
│       ├── prelacion-pago.ts
│       ├── cartera.ts
│       ├── credito.ts
│       ├── estado-credito.ts
│       ├── politica-credito.ts
│       ├── movimiento.ts
│       └── reloj.ts
│
├── tests/
│   ├── fixtures.ts
│   ├── dinero.test.ts
│   ├── plan-amortizacion.test.ts
│   ├── calculadora-mora.test.ts
│   ├── prelacion-pago.test.ts
│   ├── cartera.test.ts
│   ├── credito-estado.test.ts
│   ├── restricciones-alcance.test.ts
│   └── reporte-casos-referencia.test.ts
│
└── docs/
    ├── E1-modelo-dominio.md
    ├── E4-nucleo-ejecutable.md
    └── diagramas/
        ├── casos-de-uso.puml
        ├── clases.puml
        ├── secuencia-registrar-pago.puml
        ├── secuencia-desembolsar-credito.puml
        ├── estados-credito.puml
        └── actividad-cierre-mensual.puml

#Componentes del dominio
#4.1. Dinero

Q1,004.62
     ↓
100462 centavos

GTQ
USD

4.2. Plan de amortización
EstrategiaAmortizacion
        │
        ├── metodoFrances
        │
        └── metodoSaldosInsolutos

Capital:             Q10,000.00
Tasa anual:           36 %
Plazo:                12 meses

Última cuota:         Q1,004.63
Saldo final:          Q0.00

# 4.3. Cálculo de mora

El archivo calculadora-mora.ts contiene funciones puras relacionadas con la mora.

El módulo permite:

calcular días de atraso;
clasificar el tramo de mora;
calcular intereses moratorios;
determinar cuándo debe suspenderse el devengo.

Los tramos de mora son:
AL_DIA
MORA_1
MORA_2
MORA_3
VENCIDO
INCOBRABLE

4.4. Prelación de pagos

El archivo prelacion-pago.ts implementa el patrón Chain of Responsibility.

Los pagos se aplican siguiendo el siguiente orden:

1. Gastos
       ↓
2. Interés moratorio
       ↓
3. Interés corriente
       ↓
4. Capital

La cadena está formada por:

EslabonGastos
      ↓
EslabonInteresMoratorio
      ↓
EslabonInteresCorriente
      ↓
EslabonCapital


### 📌 Una corrección importante respecto al anterior

Yo **sí cambiaría el nombre** que te había recomendado antes de `architecture.md` a:

> **`docs/arquitectura.md`**

porque todo el proyecto/documentación está en español y así queda consistente.

Y este documento **no reemplaza** `E4-nucleo-ejecutable.md`; cumplen funciones diferentes:

- `E1-modelo-dominio.md` → **qué se diseñó inicialmente**
- `E4-nucleo-ejecutable.md` → **qué se implementó y cómo**
- `arquitectura.md` → **cómo se organiza y relaciona todo el sistema**
- `business-rules.md` → **qué reglas de negocio debe cumplir**
- `testing.md` → **cómo se demuestra que funciona**
- `adr/` → **por qué se tomaron determinadas decisiones**

Además, el resumen confirma que hay diferencias entre el diseño inicial y la implementación E4, por lo que conviene que la documentación arquitectónica refleje **el código real**, no únicamente el UML original. :contentReference[oaicite:0]{index=0}
