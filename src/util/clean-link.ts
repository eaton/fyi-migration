import { nanohash } from '@eatonfyi/ids';
import { normalize } from '@eatonfyi/urls';

export function cleanLink(input?: string | URL) {
  if (!input) return {};
  const url = normalize(input);
  return {
    type: 'Bookmark',
    id: nanohash(url),
    url: url.toString(),
  };
}
