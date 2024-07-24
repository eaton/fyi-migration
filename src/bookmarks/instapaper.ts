import { z } from 'zod';
import { BookmarkSchema } from '../schemas/custom/bookmark.js';
import { toId } from '../schemas/mapper.js';
import { CreativeWorkSchema } from '../schemas/schema-org/creative-work.js';
import { Migrator, MigratorOptions } from '../shared/migrator.js';
import { prepUrlForBookmark } from '../util/clean-link.js';

export interface InstapaperMigratorOptions extends MigratorOptions {}

const defaults: InstapaperMigratorOptions = {
  name: 'instapaper',
  label: 'Instapaper',
  input: 'input/bookmarks',
  cache: 'cache/bookmarks',
};

export class InstapaperMigrator extends Migrator {
  declare options: InstapaperMigratorOptions;
  links: InstapaperLink[] = [];

  constructor(options: InstapaperMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled() {
    return this.cache.exists('instapaper.ndjson') === 'file';
  }

  override async fillCache() {
    if (!this.input.exists('instapaper.csv')) return;

    const csv = (this.input.read('instapaper.csv', 'auto') as unknown[]) ?? [];
    this.links = z.array(schema).parse(csv);

    this.cache.write('instapaper.ndjson', this.links);
    return this.links;
  }

  override async readCache() {
    if (this.links.length === 0) {
      const raw =
        (this.cache.read('instapaper.ndjson', 'auto') as undefined[]) ?? [];
      this.links = raw.map(l => schema.parse(l));
    }
    return this.links;
  }

  override async finalize() {
    const cws = this.links.map(l => {
      const link = BookmarkSchema.parse({
        ...prepUrlForBookmark(l.URL),
        name: l.Title,
        date: l.Timestamp,
        description: l.Selection,
        isPartOf: toId('webapp', this.name),
      });
      return link;
    });

    await this.mergeThings(cws);

    const insta = CreativeWorkSchema.parse({
      type: 'WebApplication',
      id: toId('webapp', this.options.name),
      name: 'Instapaper',
      url: 'https://instapaper.com',
    });
    await this.saveThing(insta);
    return;
  }
}

const schema = z.object({
  URL: z.string().url(),
  Title: z
    .string()
    .optional()
    .transform(s => (s?.trim()?.length ? s : undefined)),
  Timestamp: z
    .number()
    .or(z.coerce.date())
    .transform(d => (typeof d === 'number' ? new Date(d * 1000) : d)),
  Selection: z
    .string()
    .optional()
    .transform(s => (s?.trim()?.length ? s : undefined)),
});

type InstapaperLink = z.infer<typeof schema>;
