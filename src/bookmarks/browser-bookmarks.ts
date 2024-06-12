import { Migrator, MigratorOptions } from "../shared/migrator.js";
import { cleanLink } from "../util/clean-link.js";
import { CreativeWorkSchema } from "../schemas/creative-work.js";
import { z } from "zod";
import { extract, ExtractTemplateObject } from "@eatonfyi/html";
import { Thing } from "../schemas/thing.js";
import micromatch from 'micromatch';

export interface BrowserBookmarkMigratorOptions extends MigratorOptions {
  file: string;
  browser?: Thing;
  ignoreUndated?: boolean;
  ignore?: string[]
}

const defaults: Partial<BrowserBookmarkMigratorOptions> = {
  name: 'browser',
  label: 'Browser Bookmarks',
  input: 'input/bookmarks/browser',
  cache: 'cache/bookmarks'
}

export class BrowserBookmarkMigrator extends Migrator {
  declare options: BrowserBookmarkMigratorOptions;
  links: BrowserBookmark[] = [];

  constructor(options: BrowserBookmarkMigratorOptions) {
    super({...defaults, ...options});
  }

  override async cacheIsFilled() {
    return this.cache.exists(`${this.options.name}.ndjson`) === 'file';
  }

  override async fillCache() {
    if (this.options.file && this.input.exists(this.options.file)) {
      const html = this.input.read(this.options.file, 'utf8') ?? '';
      this.links = await extract(html, template, z.array(schema));
    }

    if (this.options.ignoreUndated) {
      this.links = this.links.filter(l => l.date !== undefined);
    }
    if (this.options.ignore) {
      this.links = this.links.filter(l => micromatch.isMatch(l.url, this.options.ignore ?? []))
    }

    this.cache.write(`${this.options.name}.ndjson`, this.links);
    return this.links;
  }

  override async readCache() {
    if (this.links.length === 0) {
      const raw = this.cache.read(`${this.options.name}.ndjson`, 'auto') as undefined[] ?? [];
      this.links = raw.map(l => schema.parse(l)); 
    }
    return this.links;
  }
  
  override async finalize() {
    const siteStore = this.data.bucket('things');
    const linkStore = this.data.bucket('links');

    const cws = this.links.map(l => {
      const link = CreativeWorkSchema.parse({
        ...cleanLink(l.url),
        name: (l.name !== l.url) ? l.name : undefined,
        date: l.date,
        isPartOf: this.options.browser?.id ?? this.options.name
      });
      return link;
    });

    for (const cw of cws) {
      linkStore.set(cw);
    }

    this.log.info(`Saved ${cws.length} links.`)

    if (this.options.browser) {
      siteStore.set(CreativeWorkSchema.parse(this.options.browser));
    } else {
      const browser = CreativeWorkSchema.parse({
        type: 'SoftwareApplication',
        id: this.options.name,
        name: this.options.label,
        description: this.options.description,
      });
      siteStore.set(browser);
    }
  }
}

const template: ExtractTemplateObject[] = [{
  $: 'a[href]:not([href=""])',
  url: '| attr:href',
  icon: '| attr:icon',
  id: '| attr:id',
  date: '| attr:add_date',
  name: '| text'
}];

const schema = z.object({
  url: z.string().url(),
  name: z.string().optional(),
  date: z.coerce.number().optional().or(z.coerce.date()).transform(d => typeof d === 'number' ? new Date(d) : d),
});

type BrowserBookmark = z.infer<typeof schema>;
