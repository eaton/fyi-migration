import wretch from 'wretch';
import QueryStringAddon from 'wretch/addons/queryString';
import { z } from 'zod';

export type PinboardLink = z.infer<typeof linkSchema>;
export type PnboardNote = z.infer<typeof noteSchema>;

export interface PinboardPostFilter {
  tag?: string,
  start?: number,
  results?: number,
  from?: Date,
  to?: Date
}

export interface PinboardOptions {
  apiKey?: string,
  endpoint?: string,
}

const defaults: PinboardOptions = {
  apiKey: process.env.PINBOARD_API_KEY,
  endpoint: 'https://api.pinboard.in/v1/'
}

export class Pinboard {
  protected _lastUpdate?: Date;
  protected _apiKey?: string;
  protected _endpoint?: string;
  protected _lastAll?: number;
  protected _rateLimit = 300_000; // Five minutes

  constructor(options: PinboardOptions = {}) {
    const opt = { ...defaults, ...options };
    this._endpoint = opt.endpoint;
    this._apiKey = opt.apiKey;
  }

  parse(input: string | unknown[]): PinboardLink[] {
    if (typeof input === 'string') {
      return z.array(linkSchema).parse(JSON.parse(input));
    } else {
      return input.map(l => linkSchema.parse(l));
    }
  }

  async lastUpdate(force = false) {
    if (!this._lastUpdate || force) {
      this._lastUpdate = await this.api.get(this._endpoint + '/posts/update')
      .json()
      .then(json => z.object({ update_time: z.coerce.date() }).parse(json).update_time);
    }
    return this._lastUpdate;
  }

  async getAll(options: PinboardPostFilter = {}): Promise<PinboardLink[]> {
    if (this._lastAll ?? 0 + this._rateLimit > Date.now()) {
      return [];
    } else {
      this._lastAll = Date.now()
    }

    // https://api.pinboard.in/v1/posts/all
    return this.api.query({
      tag: options.tag ?? undefined,
      start: options.start ?? undefined,
      results: options.results ?? undefined,
      fromdt: options.from?.toUTCString() ?? undefined,
      todt: options.to?.toUTCString() ?? undefined
    })
    .get(this._endpoint + '/posts/all')
    .error(429, () => { throw new Error('Pinboard rate limit exceeded') })
    .json(json => z.array(linkSchema).parse(json));
  }

  async listNotes() {
    return await this.api.get('https://api.pinboard.in/v1/notes/list')
      .json(json => z.object({ count: z.number(), notes: z.array(noteSchema) }).parse(json));
  }

  async getNote(id: string) {
    return await this.api.get(`https://api.pinboard.in/v1/notes/list/${id}`)
      .json(json => noteSchema.parse(json));
  }

  protected get api() {
    if (this._apiKey === undefined) {
      throw new Error('Pinboard API requests require Auth key');
    }
    const query = {
      auth_token: this._apiKey,
      format: 'json',
    };
    return wretch().addon(QueryStringAddon).query(query);
  }
}

const noteSchema = z.object({
  id: z.string(),
  hash: z.string(),
  length: z.number(),
  text: z.string(),
});

const ynBool = z.string().optional().transform(s => s === 'yes')

const linkSchema = z.object({
  href: z.string().url(),
  description: z.string().optional().transform(s => s?.length ? s : undefined),
  extended: z.string().optional().transform(s => s?.length ? s : undefined),
  meta: z.string().optional().transform(s => s?.length ? s : undefined),
  hash: z.string(),
  time: z.coerce.date(),
  shared: ynBool,
  toread: ynBool,
  tags: z.string().optional()
    .or(z.array(z.string()))
    .transform(t => (typeof t === 'string') ? t.split(/\s+/) : t)
    .transform(a => a?.filter(i => i.trim().length))
    .transform(a => a?.length ? a : undefined)
});
