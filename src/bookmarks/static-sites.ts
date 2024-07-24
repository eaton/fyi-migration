import { ExtractTemplateObject, extract } from '@eatonfyi/html';
import { BookmarkSchema, toId } from '@eatonfyi/schema';
import { ParsedUrl, canParse } from '@eatonfyi/urls';
import { z } from 'zod';
import { Migrator, MigratorOptions } from '../shared/migrator.js';
import { prepUrlForBookmark } from '../util/clean-link.js';

export interface StaticLinkMigratorOptions extends MigratorOptions {
  sourceDates?: Record<string, Date>;
}

const defaults: StaticLinkMigratorOptions = {
  name: 'ye-olde',
  input: 'input/ye-olde',
  cache: 'cache/bookmarks',
  sourceDates: {
    mrd: new Date('1996-01-20'),
    'home-1996': new Date('1996-07-18'),
    'home-1997': new Date('1997-09-20'),
    cstone: new Date('1997-11-05'),
    hope: new Date('1997-09-25'),
    phoenix: new Date('1997-11-10'),
    'home-1998': new Date('1998-05-10'),
    'home-1999': new Date('1999-07-01'),
    'home-2000': new Date('2000-02-10'),
    'home-2002': new Date('2001-01-15'),
    'home-2003': new Date('2003-02-21'),
  },
};

export class StaticLinkMigrator extends Migrator {
  declare options: StaticLinkMigratorOptions;
  links: StaticLink[] = [];

  constructor(options: StaticLinkMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled() {
    return this.cache.exists('ye-olde.ndjson') === 'file';
  }

  override async fillCache() {
    const protocols = ['news:', 'http:', 'https:', 'gopher:', 'ftp:'];
    const folders = this.input.find({
      directories: true,
      files: false,
      recursive: false,
    });
    for (const f of folders) {
      const folder = this.input.dir(f);
      const files = folder.find({ matching: '*.html' });
      for (const page of files) {
        const markup = folder.read(page) ?? '';
        const fLinks = await extract(markup, template, z.array(schema));
        fLinks.forEach(l => {
          const url = canParse(l.url ?? '') ? new ParsedUrl(l.url!) : undefined;
          if (url && protocols.includes(url.protocol)) {
            l.source = f;
            if (this.options.sourceDates?.[f])
              l.date = this.options.sourceDates?.[f];
            this.links.push(l);
          }
        });
      }
    }

    if (this.links.length) {
      this.cache.write('ye-olde.ndjson', this.links);
    }
    return this.links;
  }

  override async readCache() {
    if (this.links.length === 0) {
      const raw =
        (this.cache.read('ye-olde.ndjson', 'auto') as undefined[]) ?? [];
      this.links = raw.map(l => schema.parse(l));
    }
    return this.links;
  }

  override async finalize() {
    const cws = this.links.map(l => {
      const link = BookmarkSchema.parse({
        ...prepUrlForBookmark(l.url),
        name: l.title || undefined,
        date: l.date,
        description: l.description || undefined,
        isPartOf: toId('site', l.source ?? this.options.name),
      });
      return link;
    });

    await this.mergeThings(cws);
    return;
  }
}

const template: ExtractTemplateObject[] = [
  {
    $: 'a',
    url: '|attr:href',
    title: '|text',
  },
];

const schema = z.object({
  url: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  source: z.string().optional(),
  date: z
    .number()
    .or(z.coerce.date())
    .transform(d => (typeof d === 'number' ? new Date(d * 1000) : d))
    .optional(),
});

type StaticLink = z.infer<typeof schema>;
