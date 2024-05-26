import jetpack from "@eatonfyi/fs-jetpack";
import wretch, { Wretch } from "wretch";
import { getDefaults } from "./get-defaults.js";
import { getRotator } from "../util/get-rotator.js";
import { HttpsProxyAgent } from "https-proxy-agent";

export interface FetcherOptions {
  fetch?: Wretch,
  proxies?: string[],
  delay?: number,
  cache?: string | typeof jetpack
  output?: string | typeof jetpack
}

const defaults = getDefaults();

export class Fetcher {
  fetcher: Wretch;
  cache: typeof jetpack;
  output: typeof jetpack;

  constructor(options: FetcherOptions = {}) {
    const opt = { ...defaults, ...options };
    this.fetcher = opt.fetch ?? wretch();
    if (opt.proxies.length) {
      const getProxy = getRotator(opt.proxies.map(ip => new HttpsProxyAgent(`https://${ip}`)));
      this.fetcher = this.fetcher.options({ agent: getProxy() });
    }

    if (typeof opt.cache === 'string') {
      opt.cache = jetpack.dir(opt.cache);
    }
    if (typeof opt.output === 'string') {
      opt.output = jetpack.dir(opt.output);
    }
    this.cache = opt.cache;
    this.output = opt.output;
  }

  async clearCache() {
    return this.cache.removeAsync();
  }
}