import { safeParse } from '@eatonfyi/urls';

const knownShorteners = [
  'is.gd',
  'bit.ly',
  'ow.ly',
  'tinyurl.com',
  'lb.cm',
  't.co',
  'nyti.ms',
  'short.io',
];

export function linkIsShortened(input: string | URL) {
  const parsed = safeParse(input.toString());
  return (
    parsed.success &&
    knownShorteners.includes(parsed.url.domain.toLocaleLowerCase())
  );
}
