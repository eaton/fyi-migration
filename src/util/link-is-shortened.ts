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
  'lnkd.in', // doesn't redirect, must check $(a[data-tracking-control-name="external_url_click"]).attr('href')
];

export function linkIsShortened(input: string | URL) {
  const parsed = safeParse(input.toString());
  return (
    parsed.success &&
    knownShorteners.includes(parsed.url.domain.toLocaleLowerCase())
  );
}
