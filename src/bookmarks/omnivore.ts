import { Migrator, MigratorOptions } from "../shared/migrator.js";
import { cleanLink } from "../util/clean-link.js";
import { CreativeWorkSchema } from "../schemas/creative-work.js";
import { Omnivore } from '@omnivore-app/api'

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
  endpoint: 'https://api-prod.omnivore.app'
}

export class OmnivoreMigrator extends Migrator {
  declare options: OmnivoreMigratorOptions;
  
  links: OmnivoreLink[] = [];

  constructor(options: OmnivoreMigratorOptions = {}) {
    super({...defaults, ...options});
  }

  override async cacheIsFilled() {
    return this.cache.exists('pinboard.ndjson') === 'file';
  }

  override async fillCache() {
    const api = new Omnivore({
      apiKey: this.options.apiKey ?? '',
      baseUrl: this.options.endpoint,
    });
    
    if (this.input.exists('omnivore.ndjson')) {
      this.links = [];
      // parse the file?
    } else {
      const items = await api.items.search({
        // after: <date>
        format: 'markdown',
        includeContent: true
      });

      this.input.write('omnivore.ndjson', items);
    }

    if (this.options.checkApi) {
      // Check if the source links are more than a day old; if so, check the API
      // for new links.
      const mostRecent = this.links.map(l => l.time.valueOf()).sort().reverse()[0];
      if (Date.now() - mostRecent > 1000 * 60 * 60 * 24) {
        const items = await api.items.search({
          after: mostRecent.valueOf(),
          format: 'markdown',
          includeContent: true,
        });
  
        // this.links.push(...newLinks);
      }
    }

    this.cache.write('pinboard.ndjson', this.links);
  }

  override async readCache() {
    if (this.links.length === 0) {
      this.links = (this.cache.read('omnivore.ndjson') as OmnivoreLink[] ?? []);
    }

    return this.links;
  }
  
  override async finalize() {
    const siteStore = this.data.bucket('things');
    const linkStore = this.data.bucket('links');

    const cws = this.links.map(l => {
      const link = CreativeWorkSchema.parse({
        ...cleanLink(l.href),
      });
    });

    for (const cw of cws) {
      linkStore.set(cw);
    }
    this.log.info(`Saved ${cws.length} links.`)

    const omnivore = CreativeWorkSchema.parse({
      type: 'WebApplication',
      id: 'omnivore',
      name: 'Omnivore',
      description: 'A newer, slicker, welf-hostable reading app.',
      url: 'https://omnivore.app',
    });
    siteStore.set(omnivore);
  }
}