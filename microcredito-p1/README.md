# Sistema de Gestión de Microcrédito — Crédito Vecino, S. A.

Proyecto 1 · Arquitectura y diseño de componentes · Análisis de Sistemas II (037) · UMG · 2026

Núcleo de cálculo financiero en TypeScript: amortización francesa, mora, prelación de pagos, ciclo de
vida del crédito y cartera en riesgo. Sin servidor, sin base de datos y sin interfaz — el alcance del
Proyecto 1 es el diseño, verificado con un núcleo ejecutable.

## Ejecución

```bash
npm install && npm test
```

No requiere base de datos, Docker ni servidor. `npm test` compila con `tsc --noEmit` (modo `strict`) y
después ejecuta la suite con Vitest.

Estado: 194 pruebas, todas en verde.

### Comandos disponibles

| Comando | Qué hace |
|---|---|
| `npm test` | Compila en modo strict y ejecuta las 194 pruebas |
| `npm run reporte` | Imprime en consola las tablas de los casos de referencia |
| `npm run test:watch` | Re-ejecuta las pruebas al guardar un archivo |
| `npm run typecheck` | Solo el compilador, sin pruebas |

### Validarlo desde Visual Studio Code

1. Abrir la carpeta: `Archivo → Abrir carpeta…` y elegir `microcredito-p1`
   (la carpeta que contiene `package.json`, no una superior).
2. Instalar dependencias: abrir la terminal integrada con `` Ctrl+Ñ `` (o `Terminal → Nueva terminal`)
   y ejecutar `npm install`.
3. Ejecutar las pruebas: `npm test`.
4. Ver las cifras del enunciado: `npm run reporte`.

Extensión recomendada: Vitest (`vitest.explorer`). VS Code la sugiere sola al abrir el proyecto,
porque está declarada en `.vscode/extensions.json`. Agrega un panel de pruebas donde cada caso aparece
con su palomita verde y se puede ejecutar individualmente.

Depuración: en el panel Ejecutar y depurar (`Ctrl+Shift+D`) hay dos configuraciones listas:
depurar todas las pruebas o solo el archivo abierto. Se pueden poner puntos de interrupción
directamente en los archivos de `src/dominio/`.


## Casos de referencia del enunciado reproducidos

| Caso | Sección | Resultado |
|---|---|---|
| Tabla de amortización, 12 filas (P = Q10,000.00, 36 % TNA, 12 meses) | 6.4.1 | Exacta, celda por celda |
| Ajuste de la última cuota | 6.4 | Cuota 12 = Q1,004.63; saldo final Q0.00 |
| Interés moratorio (Q725.76, 24 %/360, 15 días) | 6.5 | Q7.26 |
| Aplicación de pago exacto / parcial / con excedente | 6.6 | Q1,011.88 / Q500.00 / Q1,988.12 |
| Cartera en riesgo | 6.8.1 | 7.00 % |
| Cartera en riesgo tras dar por incobrable C-005 | 6.8 | 6.06 % |

## Estructura

```
microcredito-p1/
├── package.json          scripts: test
├── tsconfig.json         strict: true
├── src/dominio/          núcleo puro (E4) — sin infraestructura
├── tests/                pruebas unitarias, incluidos los casos de referencia
└── docs/
    ├── E1-modelo-dominio.md
    ├── E4-nucleo-ejecutable.md
    ├── diagramas/        UML de E1, en formato editable (PlantUML)
    ├── adr/              pendiente (E5)
    └── api/              pendiente (E5)
```

## Cómo ver los diagramas

Los diagramas están en `docs/diagramas/*.puml`, en texto PlantUML editable:

- VS Code: extensión "PlantUML".
- En línea: pegar el contenido en [plantuml.com/plantuml](https://www.plantuml.com/plantuml).

## Herramientas de IA utilizadas

Conforme a la sección 13 del enunciado, se declara el uso de asistencia de IA en este proyecto.

| Herramienta | Uso |
|---|---|
| ChatGPT (OpenAI) | Apoyo en el modelado UML, en la implementación del núcleo de cálculo en TypeScript y sus pruebas, y en la redacción de la documentación técnica. |

El uso fue de apoyo, no de sustitución: las decisiones de diseño (representación del dinero en enteros
de centavos, política de adelanto por reducción de plazo, tramos de mora como atributo derivado y no
como estado) fueron tomadas y verificadas de forma independiente contra el enunciado. Las cifras de los
casos de referencia se comprobaron a mano antes de programarlas, y cada línea del núcleo puede ser
explicada y defendida.
