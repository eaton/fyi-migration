import { z } from 'zod';
import { BookmarkSchema } from '../schemas/custom/bookmark.js';
import { CreativeWorkSchema } from '../schemas/schema-org/creative-work.js';
import { Migrator, MigratorOptions } from '../shared/migrator.js';
import { toId } from '../shared/schemer.js';
import { prepUrlForBookmark } from '../util/clean-link.js';
import { getMdbInfo, parseMdbTable } from '../util/parse-mdb.js';

export interface HavanaLinkMigratorOptions extends MigratorOptions {
  fakeStart?: Date;
  fakeEnd?: Date;
}

const defaults: HavanaLinkMigratorOptions = {
  name: 'havanamod',
  label: 'Havana Modern',
  input: 'input/datasets/access',
  cache: 'cache/bookmarks',
  fakeStart: new Date('2001-09-15'),
  fakeEnd: new Date('2001-11-10'),
};

export class HavanaLinkMigrator extends Migrator {
  declare options: HavanaLinkMigratorOptions;
  links: HavanaLink[] = [];

  constructor(options: HavanaLinkMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled() {
    return this.cache.exists('havana.ndjson') === 'file';
  }

  override async fillCache() {
    if (!this.input.exists('havana.mdb')) return;
    this.links = parseMdbTable(this.input.path('havana.mdb'), 'Link', schema);
    this.cache.write('havana.ndjson', this.links);
    return this.links;
  }

  override async readCache() {
    if (this.links.length === 0) {
      const raw =
        (this.cache.read('havana.ndjson', 'auto') as undefined[]) ?? [];
      this.links = raw.map(l => schema.parse(l));
    }
    return this.links;
  }

  override async finalize() {
    const tempDate = getMdbInfo(this.input.path('havana.mdb')).dateCreated;

    const cws = this.links.map(l => {
      const link = BookmarkSchema.parse({
        ...prepUrlForBookmark(l.url),
        name: l.title,
        description: l.summary,
        date: l.date ?? tempDate,
        isPartOf: toId('site', this.name),
      });
      return link;
    });

    await this.mergeThings(cws);

    const havana = CreativeWorkSchema.parse({
      type: 'WebSite',
      id: toId('site', this.options.name),
      name: this.options.label,
      url: 'https://havana-mod.com',
    });
    await this.saveThing(havana);
    return;
  }
}

const schema = z.object({
  id: z.number(),
  title: z.string(),
  url: z.string().url(),
  summary: z.string().optional(),
  date: z
    .number()
    .or(z.coerce.date())
    .transform(d => (typeof d === 'number' ? new Date(d * 1000) : d))
    .optional(),
});

type HavanaLink = z.infer<typeof schema>;
