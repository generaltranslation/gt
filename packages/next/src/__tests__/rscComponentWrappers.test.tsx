import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockComponents,
  mockGetEnableI18n,
  mockGetLocale,
  mockSetReadonlyConditionStore,
} = vi.hoisted(() => ({
  mockComponents: {
    RscBranch: vi.fn((props) => React.createElement('div', props)),
    RscCurrency: vi.fn((props) => React.createElement('div', props)),
    RscDateTime: vi.fn((props) => React.createElement('div', props)),
    RscNum: vi.fn((props) => React.createElement('div', props)),
    RscPlural: vi.fn((props) => React.createElement('div', props)),
    RscRelativeTime: vi.fn((props) => React.createElement('div', props)),
    RscVar: vi.fn((props) => React.createElement('div', props)),
  },
  mockGetEnableI18n: vi.fn(),
  mockGetLocale: vi.fn(),
  mockSetReadonlyConditionStore: vi.fn(),
}));

vi.mock('../request/getEnableI18n', () => ({
  getEnableI18n: mockGetEnableI18n,
}));

vi.mock('../request/getLocale', () => ({
  getLocale: mockGetLocale,
}));

vi.mock('gt-react/context', () => ({
  ...mockComponents,
  setReadonlyConditionStore: mockSetReadonlyConditionStore,
}));

describe('rsc component wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEnableI18n.mockResolvedValue(false);
    mockGetLocale.mockResolvedValue('fr');
  });

  it.each([
    ['Branch', () => import('../branches/Branch'), mockComponents.RscBranch],
    [
      'Currency',
      () => import('../variables/Currency'),
      mockComponents.RscCurrency,
    ],
    [
      'DateTime',
      () => import('../variables/DateTime'),
      mockComponents.RscDateTime,
    ],
    ['Num', () => import('../variables/Num'), mockComponents.RscNum],
    ['Plural', () => import('../branches/Plural'), mockComponents.RscPlural],
    [
      'RelativeTime',
      () => import('../variables/RelativeTime'),
      mockComponents.RscRelativeTime,
    ],
    ['Var', () => import('../variables/Var'), mockComponents.RscVar],
  ])(
    '%s renders through gt-react/context RSC implementation',
    async (componentName, loadComponent, coreComponent) => {
      const module = await loadComponent();
      const component = module[componentName];

      const element = await component({ children: 'value' });

      expect(mockGetLocale).toHaveBeenCalled();
      expect(mockGetEnableI18n).toHaveBeenCalled();
      expect(coreComponent).toHaveBeenCalledWith({ children: 'value' });
      expect(React.isValidElement(element)).toBe(true);
      expect(element.props).toMatchObject({ children: 'value' });
    }
  );
});
