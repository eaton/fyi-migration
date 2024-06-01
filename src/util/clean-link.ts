import { nanohash } from '@eatonfyi/ids';
import { normalize } from '@eatonfyi/urls';

export function cleanLink(input: string | URL) {
  const url = normalize(input);
  return { id: nanohash(url), url };
}
