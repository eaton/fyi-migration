import 'dotenv/config';
import { HttpsProxyAgent } from 'https-proxy-agent';
import PQueue from 'p-queue';
import wretch, { Wretch } from 'wretch';
import { getRotator } from '../util/get-rotator.js';
import { Migrator, MigratorOptions } from './migrator.js';

export interface FetcherOptions extends MigratorOptions {
  fetch?: Wretch;
  proxies?: string[];
  concurrency?: number;
  userAgent?: string;
}

const defaults = {
  proxies: (process.env.PROXIES?.split(' ') ?? []).filter(s => s?.length),
  concurrency: 1,
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X x.y; rv:42.0) Gecko/20100101 Firefox/42.0',
};

export class Fetcher extends Migrator {
  declare options: FetcherOptions;
  fetcher: Wretch;
  fetchQueue: PQueue = new PQueue({ autoStart: false });

  constructor(options: FetcherOptions = {}) {
    const opt = { ...defaults, ...options };
    super(opt);

    this.fetcher =
      opt.fetch ??
      wretch().headers({
        'User-Agent': this.options.userAgent ?? 'Scraper',
      });

    if (opt.proxies.length) {
      const getProxy = getRotator(
        opt.proxies.map(ip => new HttpsProxyAgent(`https://${ip}`)),
      );
      this.fetcher = this.fetcher.options({ agent: getProxy() });
    }

    this.fetchQueue.concurrency = this.options.concurrency ?? 1;
  }
}
