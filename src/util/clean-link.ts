import { nanohash } from '@eatonfyi/ids';
import { ParsedUrl } from '@eatonfyi/urls';

export function prepUrlForBookmark(input?: string | URL, salt?: string) {
  if (!input) return {};
  const url = new ParsedUrl(input);
  return {
    type: 'Bookmark',
    id: nanohash(url.toString()),
    sharedContent: url.toString(),
  };
}
