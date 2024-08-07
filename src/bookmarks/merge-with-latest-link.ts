import { Bookmark, BookmarkSchema } from '@eatonfyi/schema';
import { emptyDeep } from 'obby';
import { ArangoDB } from '../shared/arango.js';

export async function mergeWithLatestLink(db: ArangoDB, l: Bookmark) {
  const e = await db.load(db.getKey(l));
  if (e) {
    const el = BookmarkSchema.parse(e);
    if ((el.date ?? 0) < (l.date ?? 0)) {
      const nl = {
        ...(emptyDeep(el) as Bookmark),
        ...(emptyDeep(l) as Bookmark),
      };
      return await db.set(nl);
    } else {
      const nl = {
        ...(emptyDeep(l) as Bookmark),
        ...(emptyDeep(el) as Bookmark),
      };
      return await db.set(nl);
    }
  } else {
    return await db.set(l);
  }
}
