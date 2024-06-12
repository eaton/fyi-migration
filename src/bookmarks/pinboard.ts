import { Migrator, MigratorOptions } from "../shared/migrator.js";
import { Pinboard, type PinboardLink } from "../apis/pinboard.js";
import { cleanLink } from "../util/clean-link.js";
import { CreativeWorkSchema } from "../schemas/creative-work.js";

export interface PinboardMigratorOptions extends MigratorOptions {
  deliciousDate?: Date
  apiKey?: string,
  checkApi?: boolean,
  onlyShared?: boolean
}

const defaults: PinboardMigratorOptions = {
  name: 'pinboard',
  label: 'Pinboard',
  description: 'Contains both Pinboard and delicious links dating back to 2004 or so.',
  input: 'input/bookmarks',
  cache: 'cache/bookmarks',

  /**
   * API key for pinboard.in; required for API access, not required when using raw exports.
   */
  apiKey: process.env.PINBOARD_API_KEY,

  /**
   * Check the API to ensure that more links haven't been posted since the last cache.
   */
  checkApi: true,

  /**
   * Links 'created' before this date will be treated as Delicious links; they were imported
   * from Delicious anyways.
   */
  deliciousDate: new Date(2009, 8, 14),

  /**
   * Only output links that have the `shared` flag set; most do, but this can be useful for
   * private and work related bookmarks.
   */
  onlyShared: true,
}

export class PinboardMigrator extends Migrator {
  declare options: PinboardMigratorOptions;
  
  links: PinboardLink[] = [];

  constructor(options: PinboardMigratorOptions = {}) {
    super({...defaults, ...options});
  }

  override async cacheIsFilled() {
    return this.cache.exists('pinboard.ndjson') === 'file';
  }

  override async fillCache() {
    const api = new Pinboard({ apiKey: this.options.apiKey });

    if (this.input.exists('pinboard.ndjson')) {
      this.links = api.parse(this.input.read('pinboard.ndjson', 'utf8') ?? '');
    } else {
      this.links = await api.getAll();
      this.input.write('pinboard.ndjson', this.links);
    }

    if (this.options.checkApi) {
      // Check if the source links are more than a day old; if so, check the API
      // for new links.
      const mostRecent = this.links.map(l => l.time.valueOf()).sort().reverse()[0];
      if (Date.now() - mostRecent > 1000 * 60 * 60 * 24) {
        const newLinks = await api.getAll({ from: new Date(mostRecent) });
        this.links.push(...newLinks);
      }
    }

    this.cache.write('pinboard.ndjson', this.links);
  }

  override async readCache() {
    if (this.links.length === 0) {
      const api = new Pinboard();
      this.links = api.parse(this.cache.read('pinboard.ndjson', 'utf8') ?? '');
    }

    return this.links;
  }
  
  override async finalize() {
    const siteStore = this.data.bucket('things');
    const linkStore = this.data.bucket('links');

    if (this.options.onlyShared) {
      this.links = this.links.filter(l => l.shared);
    }

    const cws = this.links.map(l => {
      const link = CreativeWorkSchema.parse({
        ...cleanLink(l.href),
        date: l.time,
        name: l.description?.trim(),
        description: l.extended?.trim(),
        keywords: l.tags
      });
      if (this.options.deliciousDate) {
        link.isPartOf = (this.options.deliciousDate > l.time) ? 'delicious' : 'pinboard';
      } else {
        link.isPartOf = 'pinboard';
      }

      return link;
    });

    for (const cw of cws) {
      linkStore.set(cw);
    }
    this.log.info(`Saved ${cws.length} links.`)

    const pinboard = CreativeWorkSchema.parse({
      type: 'WebApplication',
      id: 'pinboard',
      name: 'Pinboard',
      description: 'When de.licio.us died, Pinboard took up the slack.',
      url: 'https://pinboard.in',
    });
    siteStore.set(pinboard);

    if (this.options.deliciousDate) {
      const delicious = CreativeWorkSchema.parse({
        type: 'WebApplication',
        id: 'pinboard',
        name: 'Pinboard',
        description: "Social bookmarking and link-sharing is old hat now, but Delicious put it on the map.",
        url: 'https://de.licio.us',
      });

      siteStore.set(delicious);
    }
  }
}