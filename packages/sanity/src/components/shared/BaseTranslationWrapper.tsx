import React from 'react';
import {
  ThemeProvider,
  ToastProvider,
  Box,
  Card,
  Flex,
  Spinner,
  Text,
} from '@sanity/ui';
import { buildTheme } from '@sanity/ui/theme';
import { useSecrets } from '../../hooks/useSecrets';
import { Secrets } from '../../types';

const theme = buildTheme();

interface BaseTranslationWrapperProps {
  children: React.ReactNode;
  secretsNamespace?: string;
  padding?: number;
  showContainer?: boolean;
}

export const BaseTranslationWrapper: React.FC<BaseTranslationWrapperProps> = ({
  children,
  secretsNamespace = 'translationService.secrets',
  padding = 4,
  showContainer = true,
}) => {
  const { loading: loadingSecrets, secrets } =
    useSecrets<Secrets>(secretsNamespace);

  const content = (
    <>
      {loadingSecrets && (
        <Flex padding={5} align='center' justify='center'>
          <Spinner />
        </Flex>
      )}

      {!loadingSecrets && !secrets && (
        <Box padding={padding}>
          <Card tone='caution' padding={[2, 3, 4, 4]} shadow={1} radius={2}>
            <Text>
              Can't find secrets for your translation service. Did you load them
              into this dataset?
            </Text>
          </Card>
        </Box>
      )}

      {!loadingSecrets && secrets && children}
    </>
  );

  return (
    <ThemeProvider theme={theme}>
      <ToastProvider paddingY={7}>
        {showContainer ? <Box padding={padding}>{content}</Box> : content}
      </ToastProvider>
    </ThemeProvider>
  );
};

export interface UseTranslationSecretsResult {
  loadingSecrets: boolean;
  secrets: Secrets | null;
}

export const useTranslationSecrets = (
  secretsNamespace?: string
): UseTranslationSecretsResult => {
  const { loading: loadingSecrets, secrets } = useSecrets<Secrets>(
    secretsNamespace || 'translationService.secrets'
  );

  return {
    loadingSecrets,
    secrets,
  };
};
