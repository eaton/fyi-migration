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
import { merge } from 'obby';
import { Logger, LoggerOptions, pino } from 'pino';
import { isLogger } from '../util/index.js';
import { Store, StoreableData } from './store.js';

// Auto-serialize and deserilalize data for filenames with these suffixes
jetpack.setSerializer('.json', new Json(jsonDateParser, 2));
jetpack.setSerializer('.ndjson', new NdJson(jsonDateParser));
jetpack.setSerializer('.json5', new Json5(jsonDateParser, 2));
jetpack.setSerializer('.csv', new Csv());
jetpack.setSerializer('.tsv', new Tsv());
jetpack.setSerializer('.yaml', new Yaml());
jetpack.setSerializer('.md', new Frontmatter());

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
   * The directory ad-hoc data files should be stored in. During the migration process, it can
   * be accessed using a simple Storage wrapper via the `yourMigration.data` property.
   */
  data?: string;

  /**
   * An already-populated Pino logger instance, or a set of LoggerOptions for the migration to use.
   */
  logger?: Logger | LoggerOptions;
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

  log: Logger;

  constructor(options: MigratorOptions = {}) {
    this.options = merge(defaults, options);

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
    this._data ??= new Store(this.root.dir(this.options.data ?? 'data'));
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
    return Promise.resolve();
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
    return Promise.resolve();
  }

  async cacheIsFilled(): Promise<boolean> {
    return Promise.resolve(false);
  }

  async fillCache(): Promise<unknown> {
    return Promise.resolve();
  }

  async readCache(): Promise<unknown> {
    return Promise.resolve();
  }

  async clearCache() {
    return this.cache.removeAsync();
  }

  /**
   * Perform internal processing steps necessary to scrub, reformat, etc. any of the cached data.
   */
  async process(): Promise<unknown> {
    await this.readCache();
    return Promise.resolve();
  }

  /**
   * Generates final data in the output directory, including merging data from multiple sources.
   */
  async finalize(): Promise<unknown> {
    return Promise.resolve();
  }

  async copyAssets(input?: string, output?: string, overwrite = true) {
    const inp = this.input.dir(input ?? '').path();
    const outp = this.assets.dir(output ?? '').path();

    this.log.debug(`Copying assets from ${inp} to ${outp}`);
    jetpack.copyAsync(inp, outp, { overwrite });
  }
}