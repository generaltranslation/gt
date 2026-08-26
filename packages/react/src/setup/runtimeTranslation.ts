import {
  GtInternalRuntimeTranslateJsx as runtimeTranslateJsx,
  GtInternalRuntimeTranslateString as runtimeTranslateString,
} from './runtimeTranslation.dev';

const noopRuntimeTranslate = () => {};

export const GtInternalRuntimeTranslateJsx =
  process.env.NODE_ENV === 'production'
    ? noopRuntimeTranslate
    : runtimeTranslateJsx;
export const GtInternalRuntimeTranslateString =
  process.env.NODE_ENV === 'production'
    ? noopRuntimeTranslate
    : runtimeTranslateString;
