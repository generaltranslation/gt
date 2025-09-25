import React from 'react';
import { Flex, Text, Spinner } from '@sanity/ui';

interface BatchProgressProps {
  isActive: boolean;
  current: number;
  total: number;
  operationName: string;
}

export const BatchProgress: React.FC<BatchProgressProps> = ({
  isActive,
  current,
  total,
  operationName,
}) => {
  if (!isActive) return null;

  return (
    <Flex justify="center" align="center" gap={3}>
      <Spinner size={1} />
      <Text size={1}>
        {operationName} {current} of {total}...
      </Text>
    </Flex>
  );
};