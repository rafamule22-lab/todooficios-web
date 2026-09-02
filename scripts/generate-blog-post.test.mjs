import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, isoWeekNumber } from './generate-blog-post.mjs';

test('slugify normaliza acentos y espacios', () => {
  assert.equal(slugify('Instalador de Aire Acondicionado'), 'instalador-de-aire-acondicionado');
});

test('slugify quita caracteres no alfanuméricos', () => {
  assert.equal(slugify('¿Cómo elegir un fontanero? (guía 2026)'), 'como-elegir-un-fontanero-guia-2026');
});

test('slugify recorta a 80 caracteres', () => {
  const largo = 'palabra '.repeat(20);
  assert.ok(slugify(largo).length <= 80);
});

test('isoWeekNumber devuelve la semana ISO correcta', () => {
  // El 1 de enero de 2026 es jueves -> semana ISO 1
  assert.equal(isoWeekNumber(new Date(Date.UTC(2026, 0, 1))), 1);
  // El 31 de diciembre de 2025 es miércoles, semana ISO 1 de 2026
  assert.equal(isoWeekNumber(new Date(Date.UTC(2025, 11, 31))), 1);
});
