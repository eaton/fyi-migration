import { ExtractTemplateObject, extract } from '@eatonfyi/html';
import { z } from 'zod';
import { BookmarkSchema } from '../schemas/bookmark.js';
import { CreativeWorkSchema } from '../schemas/creative-work.js';
import { Migrator, MigratorOptions } from '../shared/migrator.js';
import { prepUrlForBookmark } from '../util/clean-link.js';
import { mergeWithLatestLink } from './merge-with-latest-link.js';

export interface PocketMigratorOptions extends MigratorOptions {}

const defaults: PocketMigratorOptions = {
  name: 'getpocket',
  label: 'Pocket',
  description: 'Stuff saved to the Pocket read-it-later service.',
  input: 'input/bookmarks',
  cache: 'cache/bookmarks',
};

export class PocketMigrator extends Migrator {
  declare options: PocketMigratorOptions;
  links: PocketLink[] = [];

  constructor(options: PocketMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled() {
    return this.cache.exists('getpocket.ndjson') === 'file';
  }

  override async fillCache() {
    if (!this.input.exists('getpocket.html')) return;

    const html = this.input.read('getpocket.html', 'utf8') ?? '';
    this.links = await extract(html, template, z.array(schema));

    this.cache.write('getpocket.ndjson', this.links);
    return this.links;
  }

  override async readCache() {
    if (this.links.length === 0) {
      const raw =
        (this.cache.read('getpocket.ndjson', 'auto') as undefined[]) ?? [];
      this.links = raw.map(l => schema.parse(l));
    }
    return this.links;
  }

  override async finalize() {
    const siteStore = this.data.bucket('things');
    const linkStore = this.data.bucket('links');

    const cws = this.links.map(l => {
      const link = BookmarkSchema.parse({
        ...prepUrlForBookmark(l.url),
        name: l.name !== l.url ? l.name : undefined,
        date: l.date,
        keywords: l.tags,
        isPartOf: `getpocket`,
      });
      return link;
    });

    for (const cw of cws) {
      linkStore.set(cw);
      if (this.options.store === 'arango') await mergeWithLatestLink(this.arango, cw);
    }

    this.log.info(`Saved ${cws.length} links.`);

    const getpocket = CreativeWorkSchema.parse({
      type: 'WebApplication',
      id: 'getpocket',
      name: 'Pocket',
      description: 'One of the nicer read-it-later tools.',
      url: 'https://getpocket.com',
    });
    siteStore.set(getpocket);
    if (this.options.store === 'arango') await this.arango.set(getpocket);
  }
}

const template: ExtractTemplateObject[] = [
  {
    $: 'li > a',
    url: '| attr:href',
    date: '| attr:time_added | parseAs:int',
    tags: '| attr:tags',
    name: '| text',
  },
];

const schema = z.object({
  url: z.string().url(),
  name: z.string().optional(),
  date: z
    .number()
    .or(z.coerce.date())
    .transform(d => (typeof d === 'number' ? new Date(d * 1000) : d)),
  tags: z
    .string()
    .or(z.array(z.string()))
    .optional()
    .transform(s =>
      typeof s === 'string' ? s.split(',').filter(a => a?.trim().length) : s,
    ),
});

type PocketLink = z.infer<typeof schema>;
