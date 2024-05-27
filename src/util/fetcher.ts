import 'dotenv/config';
import wretch, { Wretch } from "wretch";
import { getRotator } from "../util/get-rotator.js";
import { HttpsProxyAgent } from "https-proxy-agent";
import { Migrator, MigratorOptions } from './migrator.js';

export interface FetcherOptions extends MigratorOptions {
  fetch?: Wretch,
  proxies?: string[],
  delay?: number,
}

const defaults = {
  proxies: process.env.PROXIES?.split(' ') ?? [],
}

export class Fetcher extends Migrator {
  declare options: FetcherOptions;
  fetcher: Wretch;

  constructor(options: FetcherOptions = {}) {
    const opt = { ...defaults, ...options };
    super(options);

    this.fetcher = opt.fetch ?? wretch();
    if (opt.proxies.length) {
      const getProxy = getRotator(opt.proxies.map(ip => new HttpsProxyAgent(`https://${ip}`)));
      this.fetcher = this.fetcher.options({ agent: getProxy() });
    }
  }
}