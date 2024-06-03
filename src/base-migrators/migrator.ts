import jetpack from '@eatonfyi/fs-jetpack';
import { Logger, LoggerOptions, pino } from 'pino';
import { Store, StoreableData } from '../shared/store.js';
import { getDefaults } from '../util/get-defaults.js';

export interface MigratorOptions {
  name?: string;
  label?: string;
  description?: string;
  root?: string;
  input?: string;
  cache?: string;
  output?: string;
  assets?: string;
  data?: string;
  logger?: Logger | LoggerOptions;
}

const defaults = getDefaults();
const loggerDefaults: LoggerOptions = {
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname,time',
    },
  },
};

function isLogger(input: unknown): input is Logger {
  return input !== null && typeof input === 'object' && 'child' in input;
}

/**
 * Base class for all Migrators, with helper functions for lazy instantiation
 * of jetpack instances, centralized logging and ,
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
    this.options = { ...defaults, ...options };

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
