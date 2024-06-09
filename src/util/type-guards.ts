import { Logger } from 'pino';

export function isLogger(input: unknown): input is Logger {
  return input !== null && typeof input === 'object' && 'child' in input;
}
