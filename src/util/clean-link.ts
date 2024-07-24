import { nanohash } from '@eatonfyi/ids';
import { toId } from '@eatonfyi/schema';
import { ParsedUrl } from '@eatonfyi/urls';

export function prepUrlForBookmark(input?: string | URL) {
  if (!input) return {};
  const url = new ParsedUrl(input);
  return {
    type: 'Bookmark',
    id: toId('link', nanohash(url.toString())),
    sharedContent: url.toString(),
  };
}
