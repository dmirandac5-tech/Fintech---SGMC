

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface ArchivoFuente {
  readonly nombre: string;
  readonly contenido: string;
}

const DIRECTORIO_DOMINIO = join(process.cwd(), 'src', 'dominio');

const ARCHIVOS_DOMINIO: readonly ArchivoFuente[] = readdirSync(DIRECTORIO_DOMINIO)
  .filter((nombre) => nombre.endsWith('.ts'))
  .map((nombre) => ({ nombre, contenido: readFileSync(join(DIRECTORIO_DOMINIO, nombre), 'utf8') }));

/** Quita comentarios para no confundir una explicación con código real. */
function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('Los cinco archivos exigidos por el enunciado existen', () => {
  const EXIGIDOS = [
    'dinero.ts',
    'plan-amortizacion.ts',
    'calculadora-mora.ts',
    'prelacion-pago.ts',
    'cartera.ts',
  ];
  for (const nombre of EXIGIDOS) {
    it(`existe src/dominio/${nombre}`, () => {
      expect(ARCHIVOS_DOMINIO.map((archivo) => archivo.nombre)).toContain(nombre);
    });
  }
});

describe('Prohibición de `any` en el núcleo de dominio (8.1)', () => {
  for (const archivo of ARCHIVOS_DOMINIO) {
    it(`${archivo.nombre} no usa \`any\``, () => {
      expect(sinComentarios(archivo.contenido)).not.toMatch(/\bany\b/);
    });
  }
});

describe('Prohibición de infraestructura en E4 (sección 4 y aceptación de E4)', () => {
  const PAQUETES_PROHIBIDOS = [
    'express',
    'fastify',
    'pg',
    'prisma',
    '@prisma/client',
    'drizzle-orm',
    'mongoose',
    'react',
    '@modelcontextprotocol/sdk',
    'langchain',
    'node:fs',
    'node:http',
    'node:net',
  ];

  for (const archivo of ARCHIVOS_DOMINIO) {
    it(`${archivo.nombre} no importa infraestructura`, () => {
      const codigo = sinComentarios(archivo.contenido);
      for (const paquete of PAQUETES_PROHIBIDOS) {
        const patron = new RegExp(`from\\s+['"]${paquete.replace('/', '\\/')}['"]`);
        expect(codigo).not.toMatch(patron);
      }
    });
  }

  it('el proyecto no declara dependencias de producción', () => {
    const crudo: unknown = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    const dependencias =
      typeof crudo === 'object' && crudo !== null && 'dependencies' in crudo
        ? (crudo as { dependencies?: Record<string, string> }).dependencies
        : undefined;
    expect(Object.keys(dependencias ?? {})).toHaveLength(0);
  });

  it('el dominio solo importa de sí mismo: cero dependencias hacia afuera', () => {
    for (const archivo of ARCHIVOS_DOMINIO) {
      for (const [, ruta] of sinComentarios(archivo.contenido).matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        expect(ruta).toMatch(/^\.\//);
      }
    }
  });
});

describe('El núcleo no lee la fecha del sistema (aceptación de E4)', () => {
  for (const archivo of ARCHIVOS_DOMINIO) {
    it(`${archivo.nombre} no llama a new Date() ni Date.now()`, () => {
      const codigo = sinComentarios(archivo.contenido);
      // `new Date(x)` CON argumento sí se permite: es una copia defensiva.
      expect(codigo).not.toMatch(/new\s+Date\s*\(\s*\)/);
      expect(codigo).not.toMatch(/Date\.now\s*\(\s*\)/);
    });
  }
});

describe('Configuración obligatoria de TypeScript (8.1)', () => {
  it('tsconfig.json tiene strict activado', () => {
    const crudo: unknown = JSON.parse(readFileSync(join(process.cwd(), 'tsconfig.json'), 'utf8'));
    const opciones =
      typeof crudo === 'object' && crudo !== null && 'compilerOptions' in crudo
        ? (crudo as { compilerOptions?: Record<string, unknown> }).compilerOptions
        : undefined;
    expect(opciones?.['strict']).toBe(true);
  });
});
