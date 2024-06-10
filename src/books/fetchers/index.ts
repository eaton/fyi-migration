import { BookFetcFunc } from './types.js';

export * from './aba.js';
export * from './rosenfeld.js';
export * from './amazon.js';
export * from './types.js';

export const fetchers: Record<string, BookFetcFunc> = {
  amazon: '',
  rosenfeldmedia: ''
  aba: ''
};