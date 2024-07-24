import { nanohash } from '@eatonfyi/ids';
import { ParsedUrl } from '@eatonfyi/urls';
import { toId } from '../schemas/index.js';

export function prepUrlForBookmark(input?: string | URL) {
  if (!input) return {};
  const url = new ParsedUrl(input);
  return {
    type: 'Bookmark',
    id: toId('link', nanohash(url.toString())),
    sharedContent: url.toString(),
  };
}
