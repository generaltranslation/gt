import { CutoffFormatConstructor } from '../formatting/custom-formats/CutoffFormat/CutoffFormat';

type IntlConstructors = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in keyof typeof Intl]: (typeof Intl)[K] extends new (...args: any[]) => any
    ? (typeof Intl)[K]
    : never;
};

export interface CustomIntlConstructors extends IntlConstructors {
  CutoffFormat: typeof CutoffFormatConstructor;
}
