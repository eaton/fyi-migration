import { BookmarkSchema, OrganizationSchema, toId } from '@eatonfyi/schema';
import { z } from 'zod';
import { Migrator, MigratorOptions } from '../shared/migrator.js';
import { prepUrlForBookmark } from '../util/clean-link.js';

export interface AutogramLinkMigrationOptions extends MigratorOptions {}

const defaults: AutogramLinkMigrationOptions = {
  name: 'autogram',
  label: 'autogram',
  input: 'input/blogs/autogram/src/links',
  cache: 'cache/bookmarks',
};

export class AutogramLinkMigrator extends Migrator {
  declare options: AutogramLinkMigrationOptions;
  links: AutogramLink[] = [];

  constructor(options: AutogramLinkMigrationOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled() {
    return this.cache.exists('autogram.ndjson') === 'file';
  }

  override async fillCache() {
    for (const f of this.input.find({ matching: '*.md' })) {
      this.links.push(schema.parse(this.input.read(f, 'auto')));
    }

    this.cache.write('autogram.ndjson', this.links);
    return this.links;
  }

  override async readCache() {
    if (this.links.length === 0) {
      const raw =
        (this.cache.read('autogram.ndjson', 'auto') as undefined[]) ?? [];
      this.links = raw.map(l => schema.parse(l));
    }
    return this.links;
  }

  override async finalize() {
    const cws = this.links.map(l => {
      const link = BookmarkSchema.parse({
        ...prepUrlForBookmark(l.data.link),
        name: l.data.title,
        date: l.data.date,
        description: l.content,
        isPartOf: toId('site', 'autogram'),
      });
      return link;
    });

    await this.mergeThings(cws);

    const autog = OrganizationSchema.parse({
      type: 'Organization',
      id: toId('org', 'autogram'),
      name: 'Autogram',
      url: 'https://autogram.is',
    });

    const autob = OrganizationSchema.parse({
      type: 'WebSite',
      id: toId('site', 'autogram'),
      name: 'Autogram',
      url: 'https://autogram.is',
    });

    await this.saveThings([autog, autob]);
    return;
  }
}
const schema = z.object({
  data: z.object({
    link: z.string().url(),
    title: z
      .string()
      .optional()
      .transform(s => (s?.trim()?.length ? s : undefined)),
    date: z
      .number()
      .or(z.coerce.date())
      .transform(d => (typeof d === 'number' ? new Date(d * 1000) : d)),
  }),
  content: z
    .string()
    .optional()
    .transform(s => (s?.trim()?.length ? s : undefined)),
});

type AutogramLink = z.infer<typeof schema>;
