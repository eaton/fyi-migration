import { Logger } from 'pino';

export function isDate(input: unknown): input is Date {
  return (
    !!input &&
    Object.prototype.toString.call(input) === '[object Date]' &&
    !isNaN(Number(input))
  );
}

export function isString(input: unknown): input is string {
  return typeof input === 'string';
}

export function isArray(input: unknown): input is [] {
  return Array.isArray(input);
}

export function isLogger(input: unknown): input is Logger {
  return input !== null && typeof input === 'object' && 'child' in input;
}
