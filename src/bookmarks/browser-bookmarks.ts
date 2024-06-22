import { ExtractTemplateObject, extract } from '@eatonfyi/html';
import micromatch from 'micromatch';
import { z } from 'zod';
import { BookmarkSchema } from '../schemas/Custom/bookmark.js';
import { CreativeWorkSchema } from '../schemas/schema-org/creative-work.js';
import { Thing } from '../schemas/schema-org/thing.js';
import { Migrator, MigratorOptions } from '../shared/migrator.js';
import { prepUrlForBookmark } from '../util/clean-link.js';

export interface BrowserBookmarkMigratorOptions extends MigratorOptions {
  file: string;
  browser?: Thing;
  webOnly?: boolean;
  ignore?: string[];
  missingDates?: 'discard' | 'ignore' | 'fake';
}

const defaults: Partial<BrowserBookmarkMigratorOptions> = {
  name: 'browser',
  label: 'Browser Bookmarks',
  input: 'input/bookmarks/browser',
  cache: 'cache/bookmarks',
  missingDates: 'ignore',
  webOnly: true,
};

export class BrowserBookmarkMigrator extends Migrator {
  declare options: BrowserBookmarkMigratorOptions;
  links: BrowserBookmark[] = [];

  // Starting points for fake bookmark dates.
  protected minDate = Math.floor(Date.now() / 1000);
  protected maxDate = 0;

  constructor(options: BrowserBookmarkMigratorOptions) {
    super({ ...defaults, ...options });
    this.minDate = Math.floor(Date.now() / 1000);
    this.maxDate = 0;
  }

  override async cacheIsFilled() {
    return this.cache.exists(`${this.options.name}.ndjson`) === 'file';
  }

  override async fillCache() {
    if (this.options.file && this.input.exists(this.options.file)) {
      const html = this.input.read(this.options.file, 'utf8') ?? '';
      this.links = await extract(html, template, z.array(schema));
    }

    if (this.options.ignore) {
      this.links = this.links.filter(
        l => !micromatch.isMatch(l.url, this.options.ignore ?? []),
      );
    }

    if (this.links.length) {
      this.cache.write(`${this.options.name}.ndjson`, this.links);
      this.log.debug(`Cached ${this.links.length} links`);
    }
    return this.links;
  }

  override async readCache() {
    if (this.links.length === 0) {
      const raw =
        (this.cache.read(
          `${this.options.name}.ndjson`,
          'auto',
        ) as undefined[]) ?? [];
      this.links = raw.map(l => schema.parse(l));
    }
    return this.links;
  }

  override async finalize() {
    if (this.options.webOnly) {
      this.links = this.links.filter(l =>
        new URL(l.url).protocol.startsWith('http'),
      );
    }

    if (this.options.missingDates) {
      if (this.options.missingDates === 'discard') {
        this.links = this.links.filter(l => l.date !== undefined);
      } else if (this.options.missingDates === 'fake') {
        for (const link of this.links) {
          this.maxDate = Math.max(this.maxDate, link.date?.valueOf() ?? 0);
          this.minDate = Math.max(
            this.maxDate,
            link.date?.valueOf() ?? Date.now() / 1000,
          );
        }

        for (const link of this.links) {
          if (link.date === undefined)
            link.date = new Date(this.randomTimeStamp());
        }
      }
    }

    const cws = this.links.map(l => {
      const link = BookmarkSchema.parse({
        ...prepUrlForBookmark(l.url),
        name: l.name !== l.url ? l.name : undefined,
        date: l.date,
        isPartOf: this.options.browser?.id ?? this.options.name,
      });
      return link;
    });

    await this.mergeThings(cws);

    const browser = this.options.browser ?? CreativeWorkSchema.parse({
      type: 'SoftwareApplication',
      id: this.options.name,
      name: this.options.label,
      description: this.options.description,
    });
    await this.saveThing(browser);
    return;
  }

  protected randomTimeStamp() {
    return (
      Math.floor(Math.random() * (this.maxDate - this.minDate)) + this.minDate
    );
  }
}

const template: ExtractTemplateObject[] = [
  {
    $: 'a[href]:not([href=""])',
    url: '| attr:href',
    icon: '| attr:icon',
    id: '| attr:id',
    date: '| attr:add_date',
    name: '| text',
  },
];

const schema = z.object({
  url: z.string().url(),
  name: z.string().optional(),
  date: z.coerce
    .number()
    .optional()
    .or(z.coerce.date())
    .transform(d => (typeof d === 'number' ? (d < 10_000_000_000 ? new Date(d * 1000) : new Date(d)) : d)),
});

type BrowserBookmark = z.infer<typeof schema>;
