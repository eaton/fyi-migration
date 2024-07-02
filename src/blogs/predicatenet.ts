import { extract, ExtractTemplateObject } from '@eatonfyi/html';
import { nanohash } from '@eatonfyi/ids';
import { z } from 'zod';
import { BookmarkSchema } from '../schemas/custom/bookmark.js';
import { CreativeWorkSchema } from '../schemas/schema-org/creative-work.js';
import { toId } from '../shared/schemer.js';
import { prepUrlForBookmark } from '../util/clean-link.js';
import { BlogMigrator, BlogMigratorOptions } from './blog-migrator.js';

const defaults: BlogMigratorOptions = {
  name: 'predicate',
  label: 'Predicate.net',
  input: 'input/blogs/predicatenet',
};

export class PredicateNetMigrator extends BlogMigrator {
  constructor(options: BlogMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  protected async writeLinks() {
    const template: ExtractTemplateObject[] = [
      {
        $: 'link',
        title: '| attr:name',
        url: '| attr:url',
        description: '| attr:description',
      },
    ];

    const schema = z.array(
      z.object({
        title: z.string(),
        url: z.string().url(),
        description: z.string().optional(),
      }),
    );

    const links = await this.input
      .readAsync('links.xml')
      .then(xml => extract(xml ?? '', template, schema, { xml: true }));

    for (const l of links ?? []) {
      const link = BookmarkSchema.parse({
        ...prepUrlForBookmark(l.url),
        date: '2001-01-01',
        name: l.title,
        description: l.description,
        isPartOf: toId('blog', this.name),
      });
      await this.saveThing(link);
    }
  }

  protected async writeQuotes() {
    const template: ExtractTemplateObject[] = [
      { $: 'quote', content: '| attr:content', speaker: '| attr:source' },
    ];
    const schema = z.array(
      z.object({ content: z.string(), speaker: z.string() }),
    );

    const quotes = await this.input
      .readAsync('quotes.xml')
      .then(xml => extract(xml ?? '', template, schema, { xml: true }));

    for (const quote of quotes ?? []) {
      const cw = CreativeWorkSchema.parse({
        id: toId('quote', nanohash(quote.content)),
        type: 'Quotation',
        isPartOf: toId('blog', this.name),
        text: quote.content,
        spokenBy: quote.speaker ?? undefined,
      });
      await this.saveThing(cw);
    }
  }

  override async finalize() {
    const site = CreativeWorkSchema.parse({
      id: toId('blog', 'predicate'),
      type: 'Blog',
      url: 'http://predicate.net',
      name: 'Predicate.net',
      hosting: 'Site5 (IIS)',
      software: 'BBEdit',
    });

    await this.saveThing(site);
    if (this.options.store === 'arango') await this.arango.set(site);

    await this.writeLinks();
    await this.writeQuotes();

    await this.copyAssets('files', 'predicatenet');
    return Promise.resolve();
  }
}
