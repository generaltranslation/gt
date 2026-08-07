import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { determineLibrary } from '../../fs/determineFramework/index.js';
import { endWorkspaceDiscoverySession } from '../../fs/determineFramework/workspacePackages.js';
import { main } from '../../index.js';
import { Libraries } from '../../types/libraries.js';

vi.mock('../../fs/determineFramework/index.js', () => ({
  determineLibrary: vi.fn(),
}));

afterEach(() => {
  endWorkspaceDiscoverySession();
  vi.clearAllMocks();
});

describe('mixed file and inline CLI routing', () => {
  it('registers Vue validation commands for a file-format primary', () => {
    vi.mocked(determineLibrary).mockReturnValue({
      additionalModules: ['i18next-icu', Libraries.GT_VUE],
      library: 'i18next',
    });
    const program = new Command();

    main(program);

    expect(program.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['generate', 'validate'])
    );
  });

  it('preserves the base command surface without an inline runtime', () => {
    vi.mocked(determineLibrary).mockReturnValue({
      additionalModules: ['i18next-icu'],
      library: 'i18next',
    });
    const program = new Command();

    main(program);

    expect(program.commands.map((command) => command.name())).not.toEqual(
      expect.arrayContaining(['generate', 'validate'])
    );
  });
});
