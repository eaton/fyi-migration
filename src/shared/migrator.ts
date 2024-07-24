import jetpack from '@eatonfyi/fs-jetpack';
import {
  Csv,
  Frontmatter,
  Json,
  Json5,
  NdJson,
  Tsv,
  Yaml,
  jsonDateParser,
} from '@eatonfyi/serializers';
import { toSlug } from '@eatonfyi/text';
import 'dotenv/config';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { emptyDeep, merge } from 'obby';
import PQueue from 'p-queue';
import { Logger, LoggerOptions, pino } from 'pino';
import wretch, { Wretch } from 'wretch';
import { CreativeWork } from '../schemas/schema-org/creative-work.js';
import { Thing, ThingSchema } from '../schemas/schema-org/thing.js';
import { getRotator } from '../util/get-rotator.js';
import { isLogger } from '../util/index.js';
import { toFilename } from '../util/to-filename.js';
import { ArangoDB } from './arango.js';
import { getId, getType, idSeparator, toId } from '../schemas/mapper.js';
import { Store, StoreableData } from './store.js';

/**
 * Standard options for all Migrator classes
 */
export interface MigratorOptions {
  /**
   * The unique name of the migration task.
   */
  name?: string;

  /**
   * Human-readable name of the migrator, falls back to name if not populated.
   */
  label?: string;

  /**
   * A longer human-readable description of the migrator, used only for notification messages ATM.
   */
  description?: string;

  /**
   * The root directory for the migration script's file operations. By default, other standard
   * directories (input, cache, output, etc) are relative to this one.
   */
  root?: string;

  /**
   * The directory the migration should use when looking for input/source files.
   */
  input?: string;

  /**
   * The directory the migration should use when caching data (for example, the results of HTTP
   * queries or complex parsing operations).
   */
  cache?: string;

  /**
   * The directory the migration's final output files should be saved to.
   */
  output?: string;

  /**
   * The directory any static assets found by the migration (image files, etc) should be copied to.
   * This allows assets for posts, etc. to be stored in a central location rather than batched with
   * their migration-specific output files.
   */
  assets?: string;

  
  /**
   * A key/value list of glob strings and replacements for output markup. This can be used
   * (for example) to replace internal links and image URLs.
   */
  urlsToFix?: Record<string, string>;

  /**
   * The directory ad-hoc data files should be stored in. During the migration process, it can
   * be accessed using a simple Storage wrapper via the `yourMigration.data` property.
   */
  data?: string;

  /**
   * An already-populated Pino logger instance, or a set of LoggerOptions for the migration to use.
   */
  logger?: Logger | LoggerOptions;

  /**
   * How progress information should be displayed to the user when a migration is triggered.
   */
  progress?: 'silent' | 'progress' | 'status' | 'details';

  store?: string | 'arango' | 'pgsql' | 'sqlite' | 'file';

  fetch?: Wretch;
  proxies?: string[];
  concurrency?: number;
  userAgent?: string;
}

const loggerDefaults: LoggerOptions = {
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname,time',
    },
  },
};

const defaults: MigratorOptions = {
  root: process.env.MIGRATION_ROOT ?? './',
  input: process.env.MIGRATION_INPUT ?? 'input',
  cache: process.env.MIGRATION_CACHE ?? 'cache',
  output: process.env.MIGRATION_OUTPUT ?? 'output',
  assets: process.env.MIGRATION_ASSETS ?? 'assets',
  data: process.env.MIGRATION_DATA ?? 'data',
  logger: loggerDefaults,
  progress: 'status',
  store: process.env.STORAGE_DEFAULT ?? 'file',
  proxies: (process.env.PROXIES?.split(' ') ?? []).filter(s => s?.length),
  concurrency: 1,
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X x.y; rv:42.0) Gecko/20100101 Firefox/42.0',
};

/**
 * Base class for all Migrators, with helper functions for lazy instantiation
 * of jetpack instances, centralized logging, and a 'data store' convenience dump.
 */
export class Migrator {
  protected options: MigratorOptions;

  protected _root?: typeof jetpack;
  protected _input?: typeof jetpack;
  protected _cache?: typeof jetpack;
  protected _output?: typeof jetpack;
  protected _assets?: typeof jetpack;
  protected _data?: Store<StoreableData>;
  protected _arango?: ArangoDB;

  fetcher: Wretch;
  fetchQueue: PQueue = new PQueue({ autoStart: false });

  log: Logger;

  constructor(options: MigratorOptions = {}) {
    this.options = merge(defaults, options);

    // Auto-serialize and deserilalize data for filenames with these suffixes
    jetpack.setSerializer('.json', new Json(jsonDateParser, 2));
    jetpack.setSerializer('.ndjson', new NdJson(jsonDateParser));
    jetpack.setSerializer('.json5', new Json5(jsonDateParser, 2));
    jetpack.setSerializer('.csv', new Csv());
    jetpack.setSerializer('.tsv', new Tsv());
    jetpack.setSerializer('.yaml', new Yaml());
    jetpack.setSerializer('.md', new Frontmatter());

    if (isLogger(this.options.logger)) {
      // Parent logger
      this.log = this.options.logger.child({ name: this.name });
    } else if (typeof this.options.logger === 'object') {
      // Settings object
      this.log = pino({
        ...loggerDefaults,
        name: this.name,
        ...this.options.logger,
      });
    } else {
      // No options passed in
      this.log = pino({ ...loggerDefaults, name: this.name });
    }

    this.fetcher =
      this.options.fetch ??
      wretch().headers({
        'User-Agent': this.options.userAgent ?? 'Eaton',
      });

    if (this.options.proxies?.length) {
      const getProxy = getRotator(
        this.options.proxies?.map(ip => new HttpsProxyAgent(`https://${ip}`)),
      );
      this.fetcher = this.fetcher.options({ agent: getProxy() });
    }

    this.fetchQueue.concurrency = this.options.concurrency ?? 1;
  }

  get name() {
    this.options.name ??= this.constructor.name;
    return this.options.name;
  }

  get label() {
    return (this.options.label ??= this.name);
  }

  get description() {
    return (this.options.description ??= this.name);
  }

  get arango() {
    this._arango ??= new ArangoDB();
    return this._arango;
  }

  get root() {
    this._root ??= jetpack.dir(this.options.root ?? '.');
    return this._root;
  }

  get input() {
    this._input ??= this.root.dir(this.options.input ?? 'input');
    return this._input;
  }

  get cache() {
    this._cache ??= this.root.dir(this.options.cache ?? 'cache');
    return this._cache;
  }

  get output() {
    this._output ??= this.root.dir(this.options.output ?? 'output');
    return this._output;
  }

  get assets() {
    this._assets ??= this.root.dir(this.options.assets ?? 'assets');
    return this._assets;
  }

  get data() {
    this._data ??= new Store({
      root: this.root.dir(this.options.data ?? 'data'),
    });
    return this._data;
  }

  /**
   * Description placeholder
   */
  async run(): Promise<unknown> {
    this.log.debug(`Populating cache`);
    await this.populate();

    this.log.debug(`Processing data`);
    await this.process();

    this.log.debug(`Processing output`);
    await this.finalize();
    return;
  }

  /**
   * Based on information from the import settings, populate the cache. This may consist of
   * copying and organizing input files, retrieving data from a remote API, etc.
   *
   * This stage is meant to avoid unecessarily thrashing remote APIs, slow database lookups,
   * and so on. As such, it should cache the retieved data in as 'raw' a form as possible to
   * avoid re-fetching if needs change.
   *
   * The cache should be UPDATED whenever possible rather than REPLACED.
   */
  async populate(): Promise<unknown> {
    const full = await this.cacheIsFilled();
    if (!full) await this.fillCache();
    return;
  }

  async cacheIsFilled(): Promise<boolean> {
    return false;
  }

  async fillCache(): Promise<unknown> {
    return;
  }

  async readCache(): Promise<unknown> {
    return;
  }

  async clearCache() {
    return this.cache.removeAsync();
  }

  /**
   * Perform internal processing steps necessary to scrub, reformat, etc. any of the cached data.
   */
  async process(): Promise<unknown> {
    await this.readCache();
    return;
  }

  /**
   * Generates final data in the output directory, including merging data from multiple sources.
   */
  async finalize(): Promise<unknown> {
    return;
  }

  /**
   * Bulk-copy media assets from the import or cache directory to the static assets folder.
   */
  async copyAssets(input?: string, output?: string, overwrite = true) {
    const inp = this.input.dir(input ?? '').path();
    const outp = this.assets.dir(output ?? '').path();

    this.log.debug(`Copying assets from ${inp} to ${outp}`);
    jetpack.copyAsync(inp, outp, { overwrite });
  }

  /**
   * Given one thing or an array of things, attempt to parse them (naively)
   * so they're ready to save as Generic Things™.
   */
  protected prepThings(input: unknown | unknown[]) {
    const raw = Array.isArray(input) ? input : [input];
    const output: Thing[] = [];
    for (const item of raw) {
      const parsed = ThingSchema.safeParse(item);
      if (parsed.success) {
        output.push(parsed.data);
      } else {
        this.log.error(item, 'Could not parse Thing');
      }
    }
    return output;
  }

  /**
   * Constructs a two-part safe filename from a date identifier (input.date,
   * input.dates.publish, and input.dates.start will be checked in sequence),
   * and a document identifier (input.name, input.slug, and input.id will be
   * used in that order). If both are found, `yyyy-MM-dd-slug-text.md` will be
   * generated.
   *
   * If both are missing, a nanohash of the input object will be used to generate
   * the filename to avoid collisions.
   */
  makeFilename = toFilename;

  async saveThings(input: Thing | Thing[], store?: string) {
    const things = Array.isArray(input) ? input : [input];
    return await Promise.all(things.map(t => this.saveThing(t, store)));
  }

  /**
   * Given a Thing, save it to the current data store, overwriting any existing
   * data saved with the same type and ID.
   */
  async saveThing(input: Thing, store?: string) {
    const storage = store ?? this.options.store;
    if (storage === 'markdown') {
      const { text, ...frontmatter } = input;
      const filename = this.makeFilename(frontmatter);
      this.output.write(filename, { data: frontmatter, content: text });
      this.log.debug(`Wrote ${input.id} to ${filename}`);
    } else if (storage === 'arango') {
      await this.arango.set(input);
      this.log.debug(`Saved ${input.id}`);
    } else {
      this.data.bucket(input.type.toLocaleLowerCase()).set(input);
    }
    return;
  }

  async mergeThings(input: Thing | Thing[], store?: string) {
    const things = Array.isArray(input) ? input : [input];
    return await Promise.all(things.map(t => this.mergeThing(t, store)));
  }

  /**
   * Given a Thing, check if an existing one exists. If so, merge data preserving
   * properties from the earliest-dated version. If not, insert the new item.
   */
  async mergeThing(input: Thing, store?: string) {
    const storage = store ?? this.options.store;
    if (storage === 'arango') {
      const ex = (await this.arango.load(this.arango.getKey(input))) as
        | Thing
        | undefined;
      if ((ex?.date ?? 0) < (input.date ?? 0)) {
        const nw = {
          ...(emptyDeep(ex) as Thing),
          ...(emptyDeep(input) as Thing),
        };
        await this.arango.set(nw);
      } else {
        const nw = {
          ...(emptyDeep(input) as Thing),
          ...(emptyDeep(ex) as Thing),
        };
        await this.arango.set(nw);
      }
    } else {
      const b = input.type.toLocaleLowerCase();
      const id = input.id;
      const ex = this.data.bucket(b).get(id) as Thing | undefined;
      if ((ex?.date ?? 0) < (input.date ?? 0)) {
        const nw = {
          ...(emptyDeep(ex) as Thing),
          ...(emptyDeep(input) as Thing),
        };
        this.data.bucket(b).set(nw);
      } else {
        const nw = {
          ...(emptyDeep(input) as Thing),
          ...(emptyDeep(ex) as Thing),
        };
        this.data.bucket(b).set(nw);
      }
    }
    this.log.debug(`Merged ${input.type} ${input.id}`);
    return;
  }

  /**
   * Creates a 'link' record between two items with a given relationship type,
   * and an optional bundle of additional properties that will live on the
   * relationship itself rather than the related entities.
   */
  async linkThings(
    from: string | Thing,
    to: string | Thing,
    rel: string | Record<string, unknown>,
    store?: string,
  ) {
    const storage = store ?? this.options.store;
    if (storage === 'arango') {
      await this.arango.link(from, to, rel).catch((err: Error) => {
        throw new Error(err.message, { cause: { from, rel, to } });
      });
      this.log.debug(`Linked ${getId(from)} to ${getId(to)}`);
    } else {
      this.log.error(
        `Linking not supported with current storage mechanism (${storage})`,
      );
    }
    return;
  }

  /**
   * Given a CreativeWork entity with defined Creators, build Link records
   * with appropriate Relations. This makes a lot of very bad assumptions
   * at the moment.
   */
  async linkCreators(input: CreativeWork) {
    if (input.creator === undefined) return;
    let personId = '';
    const workId = getType(input) + idSeparator + getId(input);
    if (!workId) return;

    if (typeof input.creator === 'string') {
      personId = toId('person', toSlug(input.creator));
      await this.saveThing({
        id: personId,
        type: 'Person',
        name: input.creator,
      });
      await this.linkThings(workId, personId, 'creator');
    } else if (Array.isArray(input.creator)) {
      for (const cr of input.creator) {
        personId = toId('person', toSlug(cr));
        await this.saveThing({
          id: personId,
          type: 'Person',
          name: cr,
        });
        await this.linkThings(workId, personId, 'creator');
      }
    } else {
      for (const [r, cr] of Object.entries(input.creator)) {
        const crs = Array.isArray(cr) ? cr : [cr];
        for (const creator of crs) {
          personId = toId('person', toSlug(creator));
          await this.saveThing({
            id: personId,
            type: 'Person',
            name: creator,
          });
          await this.linkThings(workId, personId, r);
        }
      }
    }
  }

  fixUrls(input: string) {
    let output = input;
    if (this.options.urlsToFix) {
      for (const [needle, replacement] of Object.entries(this.options.urlsToFix) ?? []) {
        output = output.replaceAll(new RegExp(needle, 'gi'), replacement);
      }
    }
    return output;
  }
}
