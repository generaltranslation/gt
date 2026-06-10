import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockComponents, mockGetRequestConditions } = vi.hoisted(() => ({
  mockComponents: {
    Branch: vi.fn(),
    Currency: vi.fn(),
    DateTime: vi.fn(),
    Num: vi.fn(),
    Plural: vi.fn(),
    RelativeTime: vi.fn(),
    Var: vi.fn(),
  },
  mockGetRequestConditions: vi.fn(),
}));

vi.mock('../request/getRequestConditions', () => ({
  getRequestConditions: mockGetRequestConditions,
}));

vi.mock('gt-react/context', () => mockComponents);

describe('rsc component wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestConditions.mockResolvedValue({
      _locale: 'fr',
      _enableI18n: false,
    });
  });

  it.each([
    ['Branch', () => import('../branches/Branch'), mockComponents.Branch],
    [
      'Currency',
      () => import('../variables/Currency'),
      mockComponents.Currency,
    ],
    [
      'DateTime',
      () => import('../variables/DateTime'),
      mockComponents.DateTime,
    ],
    ['Num', () => import('../variables/Num'), mockComponents.Num],
    ['Plural', () => import('../branches/Plural'), mockComponents.Plural],
    [
      'RelativeTime',
      () => import('../variables/RelativeTime'),
      mockComponents.RelativeTime,
    ],
    ['Var', () => import('../variables/Var'), mockComponents.Var],
  ])(
    '%s passes request conditions to gt-react/context',
    async (componentName, loadComponent, coreComponent) => {
      const module = await loadComponent();
      const component = module[componentName];

      const element = await component({ children: 'value' });

      expect(mockGetRequestConditions).toHaveBeenCalled();
      expect(React.isValidElement(element)).toBe(true);
      expect(element).toMatchObject({
        type: coreComponent,
        props: {
          children: 'value',
          _locale: 'fr',
          _enableI18n: false,
        },
      });
    }
  );
});
