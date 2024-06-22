import { nanohash, uuid } from '@eatonfyi/ids';
import { aql, Database } from 'arangojs';
import { Config } from 'arangojs/connection.js';
import { z } from 'zod';
import { Thing } from '../schemas/schema-org/thing.js';
import { NormalizedUrl } from '@eatonfyi/urls';

export class ArangoDB extends Database {
  constructor(config?: Config) {
    const envDefaults = {
      url: process.env.ARANGO_URL,
      databaseName: process.env.ARANGO_DB,
      auth: {
        username: process.env.ARANGO_USER ?? 'root',
        password: process.env.ARANGO_PASS,
      },
    };

    if (!config) {
      super(envDefaults);
    } else {
      super(config);
    }
  }

  async has(id: string, type?: string) {
    return await this.collection('thing').documentExists(this.getKey(id, type));
  }

  async load<T extends z.ZodTypeAny>(
    id: string,
    type?: string,
    schema?: T,
  ): Promise<z.infer<T>> {
    const _key =
      id.indexOf(':') > 0 ? id : `${type?.toLocaleLowerCase()}:${id}`;
    return await this.collection('thing')
      .document(_key, { graceful: true })
      .then(d => d ? (schema ? schema.parse(d) : d) : undefined);
  }

  /**
   * Push data to ArangoDB, and attempt to intuit the id/key/collection if possible.
   */
  async set(item: Thing): Promise<boolean> {
    const _key = `${item.type.toLocaleLowerCase()}:${item.id}`;
    const _id = `thing/${_key}`;

    return await this.collection('thing')
      .save({ ...item, _id, _key }, { overwriteMode: 'update' })
      .then(() => true);
  }

  /**
   * Push push the record for a URL to ArangoDB.
   */
  async setUrl(item: string | URL, data: Record<string, unknown> = {}): Promise<boolean> {
    const normalized = new NormalizedUrl(item);
    const _key = nanohash(normalized.href);
    const _id = `url/${_key}`;

    return await this.collection('url')
      .save({ ...data, href: normalized.href, parsed: normalized.properties, _id, _key }, { overwriteMode: 'update' })
      .then(() => true);
  }


  /**
   * Push data to ArangoDB, and attempt to intuit the id/key/collection if possible.
   */
  async setText(
    item: string | Thing,
    text: string,
    mime = 'text/plain',
  ): Promise<boolean> {
    const thing = `thing/${this.getKey(item)}`;
    const _key = uuid({ thing, mime });
    return await this.collection('text')
      .save({ _key, mime, text, thing }, { overwriteMode: 'update' })
      .then(() => true);
  }

  /**
   * Push data to ArangoDB, and attempt to intuit the id/key/collection if possible.
   */
  async getText<T = string>(item: string | Thing, mime = 'text/plain') {
    const thing = `thing/${this.getKey(item)}`;
    const _key = uuid({ thing, mime });
    return await this.collection('text')
      .document(_key)
      .then(d => d.text as T);
  }

  /**
   * Push data to ArangoDB, intuiting the correct key/id.
   */
  async link(
    from: string | Thing,
    to: string | Thing,
    rel?: string | Record<string, unknown>,
  ): Promise<boolean> {
    const _from =
      typeof from === 'string' ? this.getId(from) : this.getId(from);
    const _to = typeof to === 'string' ? this.getId(to) : this.getId(to);

    let otherProps: Record<string, unknown> = {};
    if (rel === undefined) {
      otherProps.rel = 'mainEntity';
    } else if (typeof rel === 'string') {
      otherProps.rel = rel;
    } else {
      otherProps = rel;
    }

    const _key = uuid({ _from, _to, rel: otherProps.rel });

    return await this.collection('link')
      .save({ _key, _from, _to, ...otherProps }, { overwriteMode: 'update' })
      .then(() => true);
  }

  async unlink(
    from: string | Thing,
    to: string | Thing,
    rel?: string,
  ): Promise<void> {
    const _from =
      typeof from === 'string' ? this.getId(from) : this.getId(from);
    const _to = typeof to === 'string' ? this.getId(to) : this.getId(to);

    if (rel) {
      const _key = uuid({ _from, _to, rel: rel });
      await this.query(aql`REMOVE ${_key} IN link`);
    } else {
      await this.query(aql`
        FOR l IN link
        FILTER l._from == ${_from}, l._to == ${_to}
        REMOVE l._key IN link
      `);
    }
    return;
  }

  /**
   * Delete the document with the given ID from ArangoDB.
   */
  async delete(item: string | Thing): Promise<boolean> {
    const _key = this.getKey(item);

    return await this.collection('thing')
      .remove({ _key })
      .then(() => true);
  }

  /**
   * Ensure a given collection exists; if it doesn't, create it.
   *
   * Returns a Promise that resolves to TRUE if the collection was created,
   * FALSE if it already existed.
   */
  async ensureCollection(name: string): Promise<boolean> {
    return this.collection(name)
      .exists()
      .then(exists => {
        if (exists) return false;
        return this.createCollection(name).then(() => true);
      });
  }

  /**
   * Ensure a given edge collection exists; if it doesn't, create it.
   *
   * Returns a Promise that resolves to TRUE if the collection was created,
   * FALSE if it already existed.
   */
  async ensureEdgeCollection(name: string) {
    return this.collection(name)
      .exists()
      .then(exists => {
        if (exists) return this.collection(name);
        return this.createEdgeCollection(name);
      });
  }

  async initialize() {
    // await this.ensureCollection('person');
    // await this.ensureCollection('organization');
    // await this.ensureCollection('creativework');
    // await this.ensureCollection('place');
    // await this.ensureCollection('event');

    await this.ensureCollection('thing');
    await this.ensureEdgeCollection('link');
    await this.ensureCollection('text');
    await this.ensureCollection('url');
    await this.ensureCollection('media');
  }

  getKey(item: string | Thing, type: string = 'thing'): string {
    if (typeof item === 'string') {
      if (item.indexOf(':') > -1) return `${item}`;
      return `${type.toLocaleLowerCase()}:${item}`;
    } else {
      return `${item.type.toLocaleLowerCase()}:${item.id}`;
    }
  }

  getId(item: string | Thing, type: string = 'thing'): string {
    if (typeof item === 'string') {
      if (item.indexOf(':') > -1) return `thing/${item}`;
      return `thing/${type.toLocaleLowerCase()}:${item}`;
    } else {
      return `thing/${item.type.toLocaleLowerCase()}:${item.id}`;
    }
  }
}
