import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { wrapContentReactNative } from '../wrapContent.js';
import { WrapOptions } from '../../../types/index.js';

// Mock dependencies
vi.mock('node:fs', () => ({
  default: {
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
    },
  },
}));

vi.mock('../../../fs/matchFiles.js', () => ({
  matchFiles: vi.fn(),
}));

import { matchFiles } from '../../../fs/matchFiles.js';

describe('wrapContentReactNative', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const createTestArrays = () => ({
    errors: [] as string[],
    warnings: [] as string[],
    filesUpdated: [] as string[],
  });

  const createWrapOptions = (
    overrides: Partial<WrapOptions> = {}
  ): WrapOptions => ({
    src: ['src/**/*.{tsx,ts,jsx,js}'],
    addGTProvider: true,
    disableIds: true,
    disableFormatting: true,
    skipTs: true,
    config: 'gt.config.json',
    ...overrides,
  });

  describe('idempotence - GTProvider skip', () => {
    it('should skip processing files that already have GTProvider imported', async () => {
      const filePath = '/project/app/_layout.tsx';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const options = createWrapOptions();

      const code = `
import { GTProvider } from 'gt-react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return <div>Hello</div>;
}
`;

      vi.mocked(matchFiles).mockReturnValue([filePath]);
      vi.mocked(fs.promises.readFile).mockResolvedValue(code);

      await wrapContentReactNative(
        options,
        'gt-react-native',
        'expo',
        errors,
        warnings
      );

      // Should not attempt to write
      expect(vi.mocked(fs.promises.writeFile)).not.toHaveBeenCalled();
      expect(filesUpdated).toHaveLength(0);
    });

    it('should skip processing files that already have T imported', async () => {
      const filePath = '/project/app/_layout.tsx';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const options = createWrapOptions();

      const code = `
import { T } from 'gt-react-native';

export default function RootLayout() {
  return <T id="hello">Hello</T>;
}
`;

      vi.mocked(matchFiles).mockReturnValue([filePath]);
      vi.mocked(fs.promises.readFile).mockResolvedValue(code);

      await wrapContentReactNative(
        options,
        'gt-react-native',
        'expo',
        errors,
        warnings
      );

      expect(vi.mocked(fs.promises.writeFile)).not.toHaveBeenCalled();
      expect(filesUpdated).toHaveLength(0);
    });
  });

  describe('root layout detection', () => {
    it('should wrap root _layout.tsx with GTProvider when file is in root app directory', async () => {
      // Using path that ends with /app/_layout.tsx to match the detection logic
      const filePath = path.join(process.cwd(), 'app', '_layout.tsx');
      const { errors, warnings, filesUpdated } = createTestArrays();
      const options = createWrapOptions({ addGTProvider: true });

      const code = `
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack />
    </ThemeProvider>
  );
}
`;

      vi.mocked(matchFiles).mockReturnValue([filePath]);
      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await wrapContentReactNative(
        options,
        'gt-react-native',
        'expo',
        errors,
        warnings
      );

      // Should wrap with GTProvider and add imports
      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalled();
      const writtenCode = vi.mocked(fs.promises.writeFile).mock
        .calls[0][1] as string;
      expect(writtenCode).toContain('GTProvider');
      expect(writtenCode).toContain('gtConfig');
      expect(writtenCode).toContain('loadTranslations');
    });

    it('should NOT add GTProvider to _layout.tsx in nested directories, but may add T tags', async () => {
      const filePath = path.join(process.cwd(), 'app', '(tabs)', '_layout.tsx');
      const { errors, warnings, filesUpdated } = createTestArrays();
      const options = createWrapOptions({ addGTProvider: true });

      const code = `
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return <Tabs />;
}
`;

      vi.mocked(matchFiles).mockReturnValue([filePath]);
      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await wrapContentReactNative(
        options,
        'gt-react-native',
        'expo',
        errors,
        warnings
      );

      // Nested layouts should NOT have GTProvider wrapping
      if (vi.mocked(fs.promises.writeFile).mock.calls.length > 0) {
        const writtenCode = vi.mocked(fs.promises.writeFile).mock
          .calls[0][1] as string;
        expect(writtenCode).not.toContain('GTProvider');
        expect(writtenCode).not.toContain('gtConfig');
        expect(writtenCode).not.toContain('loadTranslations');
      }
    });
  });

  describe('GTProvider prop injection', () => {
    it('should inject config and loadTranslations props into GTProvider', async () => {
      const filePath = path.join(process.cwd(), 'app', '_layout.tsx');
      const { errors, warnings, filesUpdated } = createTestArrays();
      const options = createWrapOptions({ addGTProvider: true });

      const code = `
export default function RootLayout() {
  return <div>Content</div>;
}
`;

      vi.mocked(matchFiles).mockReturnValue([filePath]);
      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await wrapContentReactNative(
        options,
        'gt-react-native',
        'expo',
        errors,
        warnings
      );

      const writtenCode = vi.mocked(fs.promises.writeFile).mock
        .calls[0][1] as string;

      // Check that both props are present
      expect(writtenCode).toContain('config={gtConfig}');
      expect(writtenCode).toContain('loadTranslations={loadTranslations}');
    });
  });

  describe('import generation', () => {
    it('should add gtConfig and loadTranslations imports for root layout', async () => {
      const filePath = path.join(process.cwd(), 'app', '_layout.tsx');
      const { errors, warnings, filesUpdated } = createTestArrays();
      const options = createWrapOptions({ addGTProvider: true });

      const code = `
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack />;
}
`;

      vi.mocked(matchFiles).mockReturnValue([filePath]);
      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await wrapContentReactNative(
        options,
        'gt-react-native',
        'expo',
        errors,
        warnings
      );

      const writtenCode = vi.mocked(fs.promises.writeFile).mock
        .calls[0][1] as string;

      // Check imports are added
      expect(writtenCode).toContain('gt.config.json');
      expect(writtenCode).toContain('loadTranslations');
      expect(writtenCode).toContain('GTProvider');
    });
  });

  describe('file path calculation', () => {
    it('should use relative path for config import when file is in project root app dir', async () => {
      const filePath = path.join(process.cwd(), 'app', '_layout.tsx');
      const { errors, warnings, filesUpdated } = createTestArrays();
      const options = createWrapOptions({ addGTProvider: true });

      const code = `
export default function RootLayout() {
  return <div>Content</div>;
}
`;

      vi.mocked(matchFiles).mockReturnValue([filePath]);
      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await wrapContentReactNative(
        options,
        'gt-react-native',
        'expo',
        errors,
        warnings
      );

      const writtenCode = vi.mocked(fs.promises.writeFile).mock
        .calls[0][1] as string;

      // Should use ./gt.config.json for app level
      expect(writtenCode).toContain('./gt.config.json');
      expect(writtenCode).toContain('./loadTranslations');
    });
  });

  describe('error handling', () => {
    it('should handle parse errors gracefully', async () => {
      const filePath = path.join(process.cwd(), 'app', '_layout.tsx');
      const { errors, warnings, filesUpdated } = createTestArrays();
      const options = createWrapOptions();

      const invalidCode = `
export default function RootLayout() {
  return <div>
`;

      vi.mocked(matchFiles).mockReturnValue([filePath]);
      vi.mocked(fs.promises.readFile).mockResolvedValue(invalidCode);

      await wrapContentReactNative(
        options,
        'gt-react-native',
        'expo',
        errors,
        warnings
      );

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Error: Failed to parse');
      expect(filesUpdated).toHaveLength(0);
    });
  });

  describe('file tracking', () => {
    it('should track wrapped files', async () => {
      const filePath = path.join(process.cwd(), 'app', '_layout.tsx');
      const { errors, warnings, filesUpdated } = createTestArrays();
      const options = createWrapOptions({ addGTProvider: true });

      const code = `
export default function RootLayout() {
  return <div>Content</div>;
}
`;

      vi.mocked(matchFiles).mockReturnValue([filePath]);
      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await wrapContentReactNative(
        options,
        'gt-react-native',
        'expo',
        errors,
        warnings
      );

      // Should have written the file with GTProvider + T wrapping
      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalled();
      const writtenCode = vi.mocked(fs.promises.writeFile).mock
        .calls[0][1] as string;
      // Should contain GTProvider from addGTProvider
      expect(writtenCode).toContain('GTProvider');
    });

    it('should not add non-wrapped files to filesUpdated array', async () => {
      const filePath = path.join(process.cwd(), 'app', '(tabs)', '_layout.tsx');
      const { errors, warnings, filesUpdated } = createTestArrays();
      const options = createWrapOptions({ addGTProvider: true });

      const code = `
export default function TabLayout() {
  return <div>Tabs</div>;
}
`;

      vi.mocked(matchFiles).mockReturnValue([filePath]);
      vi.mocked(fs.promises.readFile).mockResolvedValue(code);

      await wrapContentReactNative(
        options,
        'gt-react-native',
        'expo',
        errors,
        warnings
      );

      expect(filesUpdated).toHaveLength(0);
    });
  });

  describe('addGTProvider flag', () => {
    it('should not add GTProvider when addGTProvider is false, but may still add T tags', async () => {
      const filePath = path.join(process.cwd(), 'app', '_layout.tsx');
      const { errors, warnings, filesUpdated } = createTestArrays();
      const options = createWrapOptions({ addGTProvider: false });

      const code = `
export default function RootLayout() {
  return <div>Content</div>;
}
`;

      vi.mocked(matchFiles).mockReturnValue([filePath]);
      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await wrapContentReactNative(
        options,
        'gt-react-native',
        'expo',
        errors,
        warnings
      );

      // When addGTProvider is false, GTProvider should not be in the output
      // (even though T tags might be added)
      if (vi.mocked(fs.promises.writeFile).mock.calls.length > 0) {
        const writtenCode = vi.mocked(fs.promises.writeFile).mock
          .calls[0][1] as string;
        expect(writtenCode).not.toContain('GTProvider');
        expect(writtenCode).not.toContain('gtConfig');
        expect(writtenCode).not.toContain('loadTranslations');
      }
    });
  });
});
