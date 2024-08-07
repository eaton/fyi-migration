import { ExtractTemplateObject, extract } from '@eatonfyi/html';
import { BookmarkSchema, urlSchema } from '@eatonfyi/schema';
import { z } from 'zod';
import { Migrator, MigratorOptions } from '../shared/migrator.js';
import { prepUrlForBookmark } from '../util/clean-link.js';

export interface OpmlMigrationOptions extends MigratorOptions {
  date?: Date;
}

const defaults: OpmlMigrationOptions = {
  name: 'opml',
  label: 'OPML Link lists',
  input: 'input/bookmarks',
  cache: 'cache/bookmarks',
};

export class OpmlMigrator extends Migrator {
  declare options: OpmlMigrationOptions;
  links: OpmlLink[] = [];

  constructor(options: OpmlMigrationOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled() {
    return this.cache.exists(`${this.name}.ndjson`) === 'file';
  }

  override async fillCache() {
    const map = new Map<string, OpmlLink>();
    for (const f of this.input.find({ matching: '*.opml' })) {
      const links = await extract(
        this.input.read(f) ?? '',
        template,
        z.array(schema),
      );
      for (const l of links) {
        if (l.url) map.set(l.url.toString(), l);
      }
    }
    this.links = [...map.values()];

    this.cache.write(`${this.name}.ndjson`, this.links);
    return this.links;
  }

  override async readCache() {
    if (this.links.length === 0) {
      const raw =
        (this.cache.read(`${this.name}.ndjson`, 'auto') as undefined[]) ?? [];
      this.links = raw.map(l => schema.parse(l));
    }
    return this.links;
  }

  override async finalize() {
    const cws = this.links.map(l => {
      const link = BookmarkSchema.parse({
        ...prepUrlForBookmark(l.url),
        name: l.title,
        date: this.options.date,
        description: l.notes,
      });
      return link;
    });

    await this.mergeThings(cws);
    return;
  }
}

const template: ExtractTemplateObject[] = [
  {
    $: 'outline[type=Link]',
    url: '|attr:url',
    title: '|attr:title',
    notes: '|attr:notes',
  },
];

const schema = z.object({
  url: urlSchema,
  title: z
    .string()
    .optional()
    .transform(s => (s?.trim()?.length ? s : undefined)),
  notes: z
    .string()
    .optional()
    .transform(s => (s?.trim()?.length ? s : undefined)),
  date: z.coerce.date().optional(),
});

type OpmlLink = z.infer<typeof schema>;
