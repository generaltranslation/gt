import type { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Libraries } from '../types/libraries.js';

const mocks = vi.hoisted(() => ({
  baseConstruct: vi.fn(),
  baseExecute: vi.fn(),
  baseInit: vi.fn(),
  detectVueProject: vi.fn(),
  determineLibrary: vi.fn(),
  nextConstruct: vi.fn(),
  nextExecute: vi.fn(),
  nextInit: vi.fn(),
  nodeConstruct: vi.fn(),
  nodeExecute: vi.fn(),
  nodeInit: vi.fn(),
  pythonConstruct: vi.fn(),
  pythonExecute: vi.fn(),
  pythonInit: vi.fn(),
  reactConstruct: vi.fn(),
  reactExecute: vi.fn(),
  reactInit: vi.fn(),
  vueConstruct: vi.fn(),
  vueExecute: vi.fn(),
  vueInit: vi.fn(),
}));

vi.mock('@generaltranslation/vue-extractor/detect', () => ({
  detectVueProject: mocks.detectVueProject,
}));

vi.mock('../fs/determineFramework/index.js', () => ({
  determineLibrary: mocks.determineLibrary,
}));

vi.mock('../cli/base.js', () => ({
  BaseCLI: class {
    constructor(...args: unknown[]) {
      mocks.baseConstruct(...args);
    }

    init() {
      mocks.baseInit();
    }

    execute() {
      mocks.baseExecute();
    }
  },
}));

vi.mock('../cli/next.js', () => ({
  NextCLI: class {
    constructor(...args: unknown[]) {
      mocks.nextConstruct(...args);
    }

    init() {
      mocks.nextInit();
    }

    execute() {
      mocks.nextExecute();
    }
  },
}));

vi.mock('../cli/react.js', () => ({
  ReactCLI: class {
    constructor(...args: unknown[]) {
      mocks.reactConstruct(...args);
    }

    init() {
      mocks.reactInit();
    }

    execute() {
      mocks.reactExecute();
    }
  },
}));

vi.mock('../cli/node.js', () => ({
  NodeCLI: class {
    constructor(...args: unknown[]) {
      mocks.nodeConstruct(...args);
    }

    init() {
      mocks.nodeInit();
    }

    execute() {
      mocks.nodeExecute();
    }
  },
}));

vi.mock('../cli/python.js', () => ({
  PythonCLI: class {
    constructor(...args: unknown[]) {
      mocks.pythonConstruct(...args);
    }

    init() {
      mocks.pythonInit();
    }

    execute() {
      mocks.pythonExecute();
    }
  },
}));

vi.mock('../cli/vue.js', () => ({
  VueCLI: class {
    constructor(...args: unknown[]) {
      mocks.vueConstruct(...args);
    }

    init() {
      mocks.vueInit();
    }

    execute() {
      mocks.vueExecute();
    }
  },
}));

import { main } from '../index.js';

const additionalModules = ['i18next-icu'] as const;

function createProgram(): Command {
  return { name: vi.fn() } as unknown as Command;
}

describe('main Vue routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.detectVueProject.mockReturnValue(false);
  });

  it.each([
    [Libraries.GT_NEXT, mocks.nextConstruct, mocks.nextInit, mocks.nextExecute],
    [
      Libraries.GT_REACT,
      mocks.reactConstruct,
      mocks.reactInit,
      mocks.reactExecute,
    ],
    [
      Libraries.GT_REACT_NATIVE,
      mocks.reactConstruct,
      mocks.reactInit,
      mocks.reactExecute,
    ],
    [
      Libraries.GT_TANSTACK_START,
      mocks.reactConstruct,
      mocks.reactInit,
      mocks.reactExecute,
    ],
    [Libraries.GT_NODE, mocks.nodeConstruct, mocks.nodeInit, mocks.nodeExecute],
    [
      Libraries.GT_FLASK,
      mocks.pythonConstruct,
      mocks.pythonInit,
      mocks.pythonExecute,
    ],
    [
      Libraries.GT_FASTAPI,
      mocks.pythonConstruct,
      mocks.pythonInit,
      mocks.pythonExecute,
    ],
  ])(
    'keeps %s authoritative without consulting Vue discovery',
    (library, construct, init, execute) => {
      const program = createProgram();
      mocks.determineLibrary.mockReturnValue({
        library,
        additionalModules,
      });
      mocks.detectVueProject.mockReturnValue(true);

      main(program);

      expect(construct).toHaveBeenCalledWith(
        program,
        library,
        additionalModules
      );
      expect(init).toHaveBeenCalledOnce();
      expect(execute).toHaveBeenCalledOnce();
      expect(mocks.detectVueProject).not.toHaveBeenCalled();
      expect(mocks.vueConstruct).not.toHaveBeenCalled();
      expect(mocks.baseConstruct).not.toHaveBeenCalled();
    }
  );

  it.each(['base', 'next-intl', 'i18next'] as const)(
    'selects VueCLI for a Vue-owned %s project',
    (library) => {
      const program = createProgram();
      mocks.determineLibrary.mockReturnValue({
        library,
        additionalModules,
      });
      mocks.detectVueProject.mockReturnValue(true);

      main(program);

      expect(mocks.detectVueProject).toHaveBeenCalledOnce();
      expect(mocks.vueConstruct).toHaveBeenCalledWith(
        program,
        additionalModules
      );
      expect(mocks.vueInit).toHaveBeenCalledOnce();
      expect(mocks.vueExecute).toHaveBeenCalledOnce();
      expect(mocks.baseConstruct).not.toHaveBeenCalled();
    }
  );

  it.each(['base', 'next-intl', 'i18next'] as const)(
    'preserves BaseCLI for an undetected %s project',
    (library) => {
      const program = createProgram();
      mocks.determineLibrary.mockReturnValue({
        library,
        additionalModules,
      });

      main(program);

      expect(mocks.detectVueProject).toHaveBeenCalledOnce();
      expect(mocks.baseConstruct).toHaveBeenCalledWith(
        program,
        library,
        additionalModules
      );
      expect(mocks.baseInit).toHaveBeenCalledOnce();
      expect(mocks.baseExecute).toHaveBeenCalledOnce();
      expect(mocks.vueConstruct).not.toHaveBeenCalled();
    }
  );
});
