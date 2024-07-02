import { Omnivore } from '@omnivore-app/api';
import { z } from 'zod';
import { BookmarkSchema } from '../schemas/custom/bookmark.js';
import { CreativeWorkSchema } from '../schemas/schema-org/creative-work.js';
import { Migrator, MigratorOptions } from '../shared/migrator.js';
import { prepUrlForBookmark } from '../util/clean-link.js';
import { toId } from '../shared/schema-meta.js';

export interface OmnivoreMigratorOptions extends MigratorOptions {
  apiKey?: string;
  checkApi?: boolean;
  onlyShared?: boolean;
  endpoint?: string;
}

const defaults: OmnivoreMigratorOptions = {
  name: 'omnivore',
  label: 'Omnivore',
  description: 'Reading, quotes, and notes on articles from the web.',
  input: 'input/bookmarks',
  cache: 'cache/bookmarks',
  apiKey: process.env.OMNIVORE_API_KEY,
  checkApi: true,
  onlyShared: true,
  endpoint: 'https://api-prod.omnivore.app',
};

export class OmnivoreMigrator extends Migrator {
  declare options: OmnivoreMigratorOptions;

  links: OmnivoreLink[] = [];

  constructor(options: OmnivoreMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled() {
    return this.cache.exists('omnivore.ndjson') === 'file';
  }

  override async fillCache() {
    const api = new Omnivore({
      apiKey: this.options.apiKey ?? '',
      baseUrl: this.options.endpoint,
    });

    if (this.input.exists('omnivore.ndjson')) {
      this.links = z
        .array(schema)
        .parse(this.input.read('omnivore.ndjson', 'auto'));
    } else {
      let resp = await this.getNextResult(api);
      this.links.push(...resp.edges.map(e => e.node));
      let i = 0;
      while (resp.pageInfo.hasNextPage || i++ < 10) {
        resp = await this.getNextResult(api, resp);
        this.links.push(...resp.edges.map(e => e.node));
      }

      this.input.write('omnivore.ndjson', this.links);
    }

    if (this.options.checkApi) {
      // Check if the source links are more than a day old; if so, check the API
      // for new links.
      const mostRecent = this.links
        .map(l => l.savedAt.valueOf())
        .sort()
        .reverse()[0];
      if (Date.now() - mostRecent > 1000 * 60 * 60 * 24) {
        // Load just the stuff since the most recent update
      }
    }

    this.cache.write('omnivore.ndjson', this.links);
    return;
  }

  override async readCache() {
    if (this.links.length === 0 && this.cache.exists('omnivore.ndjson')) {
      this.links = z
        .array(schema)
        .parse(this.cache.read('omnivore.ndjson', 'auto'));
    }

    return this.links;
  }

  override async finalize() {
    const cws = this.links.map(l => {
      const link = BookmarkSchema.parse({
        ...prepUrlForBookmark(l.url),
        name: l.title,
        description: l.description || undefined,
        date: l.savedAt,
        keywords: l.labels,
        isPartOf: toId('webapp', this.name),
      });
      for (const h of l.highlights ?? []) {
        if (h.type === 'NOTE' && h.annotation?.length) {
          link.notes ??= [];
          (link.notes as string[]).push(h.annotation);
        } else if (h.type === 'HIGHLIGHT' && h.quote?.length) {
          link.highlights ??= [];
          (link.highlights as string[]).push(h.quote);
        }
      }
      return link;
    });

    await this.mergeThings(cws);

    const omnivore = CreativeWorkSchema.parse({
      type: 'WebApplication',
        id: toId('webapp', 'omnivore'),
      name: 'Omnivore',
      description: 'A newer, slicker, self-hostable reading app.',
      url: 'https://omnivore.app',
    });
    await this.saveThing(omnivore);
    return;
  }

  async getNextResult(api: Omnivore, response?: OmnivoreApiResponse) {
    const resp = await api.items.search({
      format: 'markdown',
      includeContent: false,
      first: 100,
      after: response?.pageInfo.endCursor ? response.pageInfo.endCursor + 1 : 0,
    });

    return apiResponseSchema.parse(resp);
  }
}

const highlight = z.object({
  id: z.string(),
  quote: z.string().nullable(),
  annotation: z.string().nullable(),
  labels: z.array(z.string()).optional(),
  type: z.string(),
  createdAt: z.coerce.date(),
});

const schema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string().nullable(),
  url: z.string().url(),
  image: z.string().url().nullable(),

  publishedAt: z.coerce.date().nullable(),
  savedAt: z.coerce.date(),
  readAt: z.coerce.date().nullable(),
  archivedAt: z.string().url().nullable(),

  description: z.string().nullable(),
  labels: z.array(z.string()).optional(),
  content: z.string().nullable(),
  highlights: z.array(highlight),
  wordsCount: z.number().nullable(),
  readingProgressPercent: z.number().nullable(),
});

const apiResponseSchema = z.object({
  __typename: z.string(),
  edges: z.array(
    z.object({
      node: schema,
    }),
  ),
  pageInfo: z.object({
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
    startCursor: z.coerce.number().optional(),
    endCursor: z.coerce.number(),
    totalCount: z.coerce.number(),
  }),
});

type OmnivoreApiResponse = z.infer<typeof apiResponseSchema>;
type OmnivoreLink = z.infer<typeof schema>;
