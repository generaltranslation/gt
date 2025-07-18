import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiOptions, sendUpdates } from '../sendUpdates.js';
import { gt } from '../../utils/gt.js';
import {
  createSpinner,
  logSuccess,
  logWarning,
} from '../../console/logging.js';
import { isUsingLocalTranslations } from '../../config/utils.js';
import updateConfig from '../../fs/config/updateConfig.js';
import { SpinnerResult } from '@clack/prompts';
import {
  EnqueueEntriesOptions,
  EnqueueEntriesResult,
  Updates,
} from 'generaltranslation/types';

// Mock dependencies
vi.mock('../../utils/gt.js', () => ({
  gt: {
    enqueueEntries: vi.fn(),
  },
}));

vi.mock('../../console/logging.js', () => ({
  createSpinner: vi.fn(),
  logSuccess: vi.fn(),
  logWarning: vi.fn(),
}));

vi.mock('../../config/utils.js', () => ({
  isUsingLocalTranslations: vi.fn(),
}));

vi.mock('../../fs/config/updateConfig.js', () => ({
  default: vi.fn(),
}));

describe('sendUpdates', () => {
  const mockSpinner = {
    start: vi.fn(),
    stop: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSpinner).mockReturnValue(
      mockSpinner as unknown as SpinnerResult
    );
    vi.mocked(isUsingLocalTranslations).mockReturnValue(false);
    vi.mocked(updateConfig).mockResolvedValue(undefined);
  });

  it('should send updates successfully', async () => {
    const mockUpdates = [
      {
        dataFormat: 'I18NEXT' as const,
        source: 'Hello world',
        metadata: { context: 'greeting' },
      },
      {
        dataFormat: 'ICU' as const,
        source: 'Goodbye world',
        metadata: { context: 'farewell' },
      },
    ];

    const mockOptions: ApiOptions = {
      defaultLocale: 'en',
      locales: ['es', 'fr'],
      description: 'Test updates',
      requireApproval: false,
      dataFormat: 'I18NEXT' as const,
      timeout: '30000',
      config: '/path/to/config.json',
      baseUrl: 'https://api.generaltranslation.com',
      dashboardUrl: 'https://dashboard.generaltranslation.com',
      apiKey: '1234567890',
      projectId: '1234567890',
      stageTranslations: false,
      version: '1.0.0',
      src: ['src'],
      files: {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
      },
    };

    const mockResponse = {
      versionId: 'version-456',
      message: 'Updates sent successfully',
      locales: ['es', 'fr'],
      projectSettings: {
        cdnEnabled: false,
        requireApproval: false,
      },
    };

    const mockEnqueueEntriesOptions: EnqueueEntriesOptions = {
      sourceLocale: 'en',
      targetLocales: ['es', 'fr'],
      description: 'Test updates',
      dataFormat: 'I18NEXT',
      version: '1.0.0',
      requireApproval: false,
    };

    vi.mocked(gt.enqueueEntries).mockResolvedValue(mockResponse);

    const result = await sendUpdates(mockUpdates, mockOptions, 'gt-react');

    expect(mockSpinner.start).toHaveBeenCalledWith(
      'Sending gt-react updates to General Translation API...'
    );

    expect(gt.enqueueEntries).toHaveBeenCalledWith(
      mockUpdates,
      mockEnqueueEntriesOptions
    );

    expect(mockSpinner.stop).toHaveBeenCalledWith(
      expect.stringContaining('Sent updates')
    );

    expect(logSuccess).toHaveBeenCalledWith('Updates sent successfully');

    expect(updateConfig).toHaveBeenCalledWith({
      configFilepath: '/path/to/config.json',
      _versionId: 'version-456',
      locales: ['es', 'fr'],
    });

    expect(result).toEqual({
      versionId: 'version-456',
      locales: ['es', 'fr'],
    });
  });

  it('should handle API errors', async () => {
    const mockUpdates: Updates = [
      {
        dataFormat: 'I18NEXT' as const,
        source: 'Hello world',
        metadata: {},
      },
    ];

    const mockOptions: ApiOptions = {
      defaultLocale: 'en',
      locales: ['es'],
      timeout: '30000',
      dataFormat: 'I18NEXT' as const,
      config: '/path/to/config.json',
      baseUrl: 'https://api.generaltranslation.com',
      dashboardUrl: 'https://dashboard.generaltranslation.com',
      apiKey: '1234567890',
      projectId: '1234567890',
      stageTranslations: false,
      src: ['src'],
      files: {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
      },
    };

    const error = new Error('API Error');
    vi.mocked(gt.enqueueEntries).mockRejectedValue(error);

    await expect(
      sendUpdates(mockUpdates, mockOptions, 'gt-react')
    ).rejects.toThrow('API Error');

    expect(mockSpinner.start).toHaveBeenCalled();
    expect(mockSpinner.stop).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send updates')
    );
  });

  it('should exclude timeout from options passed to API', async () => {
    const mockUpdates: Updates = [
      {
        dataFormat: 'I18NEXT' as const,
        source: 'Hello world',
        metadata: {},
      },
    ];

    const mockOptions: ApiOptions = {
      defaultLocale: 'en',
      locales: ['es'],
      timeout: '30000',
      dataFormat: 'I18NEXT' as const,
      description: 'Test',
      config: '/path/to/config.json',
      baseUrl: 'https://api.generaltranslation.com',
      dashboardUrl: 'https://dashboard.generaltranslation.com',
      apiKey: '1234567890',
      projectId: '1234567890',
      stageTranslations: false,
      version: '1.0.0',
      requireApproval: false,
      src: ['src'],
      files: {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
      },
    };

    const mockResponse: EnqueueEntriesResult = {
      versionId: 'version-456',
      message: 'Updates sent successfully',
      locales: ['es'],
      projectSettings: {
        cdnEnabled: false,
        requireApproval: false,
      },
    };

    const mockEnqueueEntriesOptions: EnqueueEntriesOptions = {
      sourceLocale: 'en',
      targetLocales: ['es'],
      dataFormat: 'I18NEXT',
      description: 'Test',
      version: '1.0.0',
      requireApproval: false,
    };

    vi.mocked(gt.enqueueEntries).mockResolvedValue(mockResponse);

    await sendUpdates(mockUpdates, mockOptions, 'gt-react');

    expect(gt.enqueueEntries).toHaveBeenCalledWith(
      mockUpdates,
      mockEnqueueEntriesOptions
    );
  });

  it('should warn when using local translations with CDN enabled', async () => {
    const mockUpdates: Updates = [
      {
        dataFormat: 'I18NEXT' as const,
        source: 'Hello world',
        metadata: {},
      },
    ];

    const mockOptions: ApiOptions = {
      defaultLocale: 'en',
      locales: ['es'],
      timeout: '30000',
      dataFormat: 'I18NEXT' as const,
      config: '/path/to/config.json',
      baseUrl: 'https://api.generaltranslation.com',
      dashboardUrl: 'https://dashboard.generaltranslation.com',
      apiKey: '1234567890',
      projectId: '1234567890',
      stageTranslations: false,
      src: ['src'],
      files: {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
      },
    };

    const mockResponse: EnqueueEntriesResult = {
      versionId: 'version-456',
      message: 'Updates sent successfully',
      locales: ['es'],
      projectSettings: {
        cdnEnabled: true,
        requireApproval: false,
      },
    };

    vi.mocked(gt.enqueueEntries).mockResolvedValue(mockResponse);
    vi.mocked(isUsingLocalTranslations).mockReturnValue(true);

    await sendUpdates(mockUpdates, mockOptions, 'gt-react');

    expect(logWarning).toHaveBeenCalledWith(
      expect.stringContaining(
        'Your project is configured to use the CDN, but you are also using local translations'
      )
    );
  });

  it('should warn when not using local translations and CDN is disabled', async () => {
    const mockUpdates: Updates = [
      {
        dataFormat: 'I18NEXT' as const,
        source: 'Hello world',
        metadata: {},
      },
    ];

    const mockOptions: ApiOptions = {
      defaultLocale: 'en',
      locales: ['es'],
      timeout: '30000',
      dataFormat: 'I18NEXT' as const,
      config: '/path/to/config.json',
      baseUrl: 'https://api.generaltranslation.com',
      dashboardUrl: 'https://dashboard.generaltranslation.com',
      apiKey: '1234567890',
      projectId: '1234567890',
      stageTranslations: false,
      src: ['src'],
      files: {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
      },
    };

    const mockResponse: EnqueueEntriesResult = {
      versionId: 'version-456',
      message: 'Updates sent successfully',
      locales: ['es'],
      projectSettings: {
        cdnEnabled: false,
        requireApproval: false,
      },
    };

    vi.mocked(gt.enqueueEntries).mockResolvedValue(mockResponse);
    vi.mocked(isUsingLocalTranslations).mockReturnValue(false);

    await sendUpdates(mockUpdates, mockOptions, 'gt-react');

    expect(logWarning).toHaveBeenCalledWith(
      expect.stringContaining(
        'Your project is not using the CDN, nor are you using local translations'
      )
    );
  });

  it('should not warn when configurations are consistent', async () => {
    const mockUpdates: Updates = [
      {
        dataFormat: 'I18NEXT' as const,
        source: 'Hello world',
        metadata: {},
      },
    ];

    const mockOptions: ApiOptions = {
      defaultLocale: 'en',
      locales: ['es'],
      dataFormat: 'I18NEXT' as const,
      config: '/path/to/config.json',
      baseUrl: 'https://api.generaltranslation.com',
      dashboardUrl: 'https://dashboard.generaltranslation.com',
      apiKey: '1234567890',
      projectId: '1234567890',
      stageTranslations: false,
      src: ['src'],
      timeout: '30000',
      files: {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
      },
    };

    const mockResponse: EnqueueEntriesResult = {
      versionId: 'version-456',
      message: 'Updates sent successfully',
      locales: ['es'],
      projectSettings: {
        cdnEnabled: true,
        requireApproval: false,
      },
    };

    vi.mocked(gt.enqueueEntries).mockResolvedValue(mockResponse);
    vi.mocked(isUsingLocalTranslations).mockReturnValue(false);

    await sendUpdates(mockUpdates, mockOptions, 'gt-react');

    expect(logWarning).not.toHaveBeenCalled();
  });

  it('should not update config if config path is not provided', async () => {
    const mockUpdates: Updates = [
      {
        dataFormat: 'I18NEXT' as const,
        source: 'Hello world',
        metadata: {},
      },
    ];

    const mockOptions: ApiOptions = {
      defaultLocale: 'en',
      config: '',
      locales: ['es'],
      timeout: '30000',
      dataFormat: 'I18NEXT' as const,
      baseUrl: 'https://api.generaltranslation.com',
      dashboardUrl: 'https://dashboard.generaltranslation.com',
      apiKey: '1234567890',
      projectId: '1234567890',
      stageTranslations: false,
      src: ['src'],
      files: {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
      },
      // No config path provided
    };

    const mockResponse: EnqueueEntriesResult = {
      versionId: 'version-456',
      message: 'Updates sent successfully',
      locales: ['es'],
      projectSettings: {
        cdnEnabled: false,
        requireApproval: false,
      },
    };

    vi.mocked(gt.enqueueEntries).mockResolvedValue(mockResponse);

    await sendUpdates(mockUpdates, mockOptions, 'gt-react');

    expect(updateConfig).not.toHaveBeenCalled();
  });

  it('should handle empty updates array', async () => {
    const mockUpdates: Updates = [];

    const mockOptions: ApiOptions = {
      defaultLocale: 'en',
      locales: ['es'],
      timeout: '30000',
      dataFormat: 'I18NEXT' as const,
      config: '/path/to/config.json',
      baseUrl: 'https://api.generaltranslation.com',
      dashboardUrl: 'https://dashboard.generaltranslation.com',
      apiKey: '123467890',
      projectId: '123467890',
      stageTranslations: false,
      src: ['src'],
      files: {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
      },
    };

    const mockResponse: EnqueueEntriesResult = {
      versionId: 'version-456',
      message: 'No updates to send',
      locales: ['es'],
      projectSettings: {
        cdnEnabled: false,
        requireApproval: false,
      },
    };

    vi.mocked(gt.enqueueEntries).mockResolvedValue(mockResponse);

    const result = await sendUpdates(mockUpdates, mockOptions, 'gt-react');

    expect(gt.enqueueEntries).toHaveBeenCalledWith([], expect.any(Object));
    expect(result).toEqual({
      versionId: 'version-456',
      locales: ['es'],
    });
  });

  it('should handle different supported libraries', async () => {
    const mockUpdates: Updates = [
      {
        dataFormat: 'I18NEXT' as const,
        source: 'Hello world',
        metadata: {},
      },
    ];

    const mockOptions: ApiOptions = {
      defaultLocale: 'en',
      locales: ['es'],
      timeout: '30000',
      dataFormat: 'I18NEXT' as const,
      config: '/path/to/config.json',
      baseUrl: 'https://api.generaltranslation.com',
      dashboardUrl: 'https://dashboard.generaltranslation.com',
      apiKey: '123467890',
      projectId: '123467890',
      stageTranslations: false,
      src: ['src'],
      files: {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
      },
    };

    const mockResponse = {
      versionId: 'version-456',
      message: 'Updates sent successfully',
      locales: ['es'],
      projectSettings: {
        cdnEnabled: false,
        requireApproval: false,
      },
    };

    vi.mocked(gt.enqueueEntries).mockResolvedValue(mockResponse);

    await sendUpdates(mockUpdates, mockOptions, 'gt-next');

    expect(mockSpinner.start).toHaveBeenCalledWith(
      'Sending gt-next updates to General Translation API...'
    );
  });

  it('should handle network timeout errors', async () => {
    const mockUpdates = [
      {
        dataFormat: 'I18NEXT' as const,
        source: 'Hello world',
        metadata: {},
      },
    ];

    const mockOptions: ApiOptions = {
      defaultLocale: 'en',
      locales: ['es'],
      timeout: '30000',
      dataFormat: 'I18NEXT' as const,
      config: '/path/to/config.json',
      baseUrl: 'https://api.generaltranslation.com',
      dashboardUrl: 'https://dashboard.generaltranslation.com',
      apiKey: '1234567890',
      projectId: '1234567890',
      stageTranslations: false,
      src: ['src'],
      files: {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
      },
    };

    const timeoutError = new Error('Network timeout');
    vi.mocked(gt.enqueueEntries).mockRejectedValue(timeoutError);

    await expect(
      sendUpdates(mockUpdates, mockOptions, 'gt-react')
    ).rejects.toThrow('Network timeout');

    expect(mockSpinner.stop).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send updates')
    );
  });

  it('should handle authentication errors', async () => {
    const mockUpdates = [
      {
        dataFormat: 'I18NEXT' as const,
        source: 'Hello world',
        metadata: {},
      },
    ];

    const mockOptions: ApiOptions = {
      defaultLocale: 'en',
      locales: ['es'],
      timeout: '30000',
      dataFormat: 'I18NEXT' as const,
      config: '/path/to/config.json',
      baseUrl: 'https://api.generaltranslation.com',
      dashboardUrl: 'https://dashboard.generaltranslation.com',
      apiKey: '1234567890',
      projectId: '1234567890',
      stageTranslations: false,
      src: ['src'],
      files: {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
      },
    };

    const authError = new Error('Unauthorized');
    vi.mocked(gt.enqueueEntries).mockRejectedValue(authError);

    await expect(
      sendUpdates(mockUpdates, mockOptions, 'gt-react')
    ).rejects.toThrow('Unauthorized');

    expect(mockSpinner.stop).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send updates')
    );
  });

  it('should call updateConfig when config path is provided', async () => {
    const mockUpdates = [
      {
        dataFormat: 'I18NEXT' as const,
        source: 'Hello world',
        metadata: {},
      },
    ];

    const mockOptions: ApiOptions = {
      defaultLocale: 'en',
      locales: ['es'],
      timeout: '30000',
      dataFormat: 'I18NEXT' as const,
      config: '/path/to/config.json',
      baseUrl: 'https://api.generaltranslation.com',
      dashboardUrl: 'https://dashboard.generaltranslation.com',
      apiKey: '1234567890',
      projectId: '1234567890',
      stageTranslations: false,
      src: ['src'],
      files: {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
      },
    };

    const mockResponse = {
      versionId: 'version-456',
      message: 'Updates sent successfully',
      locales: ['es'],
      projectSettings: {
        cdnEnabled: false,
        requireApproval: false,
      },
    };

    vi.mocked(gt.enqueueEntries).mockResolvedValue(mockResponse);
    vi.mocked(updateConfig).mockResolvedValue(undefined);

    const result = await sendUpdates(mockUpdates, mockOptions, 'gt-react');

    expect(updateConfig).toHaveBeenCalledWith({
      configFilepath: '/path/to/config.json',
      _versionId: 'version-456',
      locales: ['es'],
    });

    expect(result).toEqual({
      versionId: 'version-456',
      locales: ['es'],
    });
  });
});
