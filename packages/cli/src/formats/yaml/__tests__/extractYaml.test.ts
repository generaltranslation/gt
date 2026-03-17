import { describe, it, expect, vi, afterEach } from 'vitest';
import { extractYaml } from '../extractYaml.js';
import { logger } from '../../../console/logger.js';

vi.mock('../../../console/logger.js');

describe('extractYaml', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should extract translatable values from a merged YAML file', () => {
    const mergedYaml = `
ui:
  buttons:
    submit: Enviar
    cancel: Cancelar
  labels:
    name: Nombre
config:
  maxRetries: 5
  timeout: 3000
`;
    const result = extractYaml(mergedYaml, 'test.yaml', {
      yamlSchema: {
        '**/*.yaml': {
          include: ['$.ui.buttons.*', '$.ui.labels.*'],
        },
      },
    });

    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed['/ui/buttons/submit']).toBe('Enviar');
    expect(parsed['/ui/buttons/cancel']).toBe('Cancelar');
    expect(parsed['/ui/labels/name']).toBe('Nombre');
    // Non-translatable fields should not be included
    expect(parsed['/config/maxRetries']).toBeUndefined();
    expect(parsed['/config/timeout']).toBeUndefined();
  });

  it('should return null when no schema matches', () => {
    const yaml = 'title: "Test"';
    const result = extractYaml(yaml, '/unmatched/path.txt', {
      yamlSchema: {
        '**/*.yaml': {
          include: ['$.title'],
        },
      },
    });

    expect(result).toBeNull();
  });

  it('should return null when no yamlSchema is configured', () => {
    const yaml = 'title: "Test"';
    const result = extractYaml(yaml, 'test.yaml', {});
    expect(result).toBeNull();
  });

  it('should return null for invalid YAML', () => {
    const invalidYaml = `
title: "Valid start"
  invalid: indentation
    bad: structure
`;
    const result = extractYaml(invalidYaml, 'test.yaml', {
      yamlSchema: {
        '**/*.yaml': {
          include: ['$.title'],
        },
      },
    });

    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });

  it('should handle recursive include paths', () => {
    const yaml = `
navigation:
  main:
    links:
      - text: Inicio
        url: /home
      - text: Acerca
        url: /about
  footer:
    links:
      - text: Contacto
        url: /contact
`;
    const result = extractYaml(yaml, 'test.yaml', {
      yamlSchema: {
        '**/*.yaml': {
          include: ['$..text'],
        },
      },
    });

    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed['/navigation/main/links/0/text']).toBe('Inicio');
    expect(parsed['/navigation/main/links/1/text']).toBe('Acerca');
    expect(parsed['/navigation/footer/links/0/text']).toBe('Contacto');
    // URLs should not be included
    expect(parsed['/navigation/main/links/0/url']).toBeUndefined();
  });

  it('should produce output compatible with mergeYaml input', () => {
    // This tests the round-trip: extractYaml output can be fed back into mergeYaml
    const mergedYaml = `
messages:
  welcome: Bienvenido
  goodbye: Adiós
settings:
  debug: false
  version: 2
`;
    const result = extractYaml(mergedYaml, 'test.yaml', {
      yamlSchema: {
        '**/*.yaml': {
          include: ['$.messages.*'],
        },
      },
    });

    expect(result).not.toBeNull();
    // The result should be valid JSON (which is what mergeYaml expects)
    const parsed = JSON.parse(result!);
    expect(typeof parsed).toBe('object');
    // Keys should be JSON pointers
    expect(parsed['/messages/welcome']).toBe('Bienvenido');
    expect(parsed['/messages/goodbye']).toBe('Adiós');
  });

  it('should only include string values, not booleans or numbers', () => {
    const yaml = `
ui:
  title: "Dashboard"
  enabled: true
  count: 42
  description: "Main page"
`;
    const result = extractYaml(yaml, 'test.yaml', {
      yamlSchema: {
        '**/*.yaml': {
          include: ['$.ui.*'],
        },
      },
    });

    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed['/ui/title']).toBe('Dashboard');
    expect(parsed['/ui/description']).toBe('Main page');
    expect(parsed['/ui/enabled']).toBeUndefined();
    expect(parsed['/ui/count']).toBeUndefined();
  });

  it('should return null when all matched values are non-string', () => {
    const yaml = `
config:
  debug: true
  retries: 3
  verbose: false
`;
    const result = extractYaml(yaml, 'test.yaml', {
      yamlSchema: {
        '**/*.yaml': {
          include: ['$.config.*'],
        },
      },
    });

    expect(result).toBeNull();
  });
});
