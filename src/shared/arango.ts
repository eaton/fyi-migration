import { uuid } from '@eatonfyi/ids';
import { Database, aql } from 'arangojs';
import { Config } from 'arangojs/connection.js';
import { z } from 'zod';
import { Thing } from '../schemas/schema-org/thing.js';
import { schemer } from './index.js';

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

  async has(id: string) {
    const collection = schemer.getCollection(id);
    return await this.collection(collection).documentExists(id);
  }

  async load<T extends z.ZodTypeAny>(
    id: string,
    schema?: T,
  ): Promise<z.infer<T>> {
    const key = this.getKey(id);
    const collection = this.getCollection(id);
    return await this.collection(collection)
      .document(key, { graceful: true })
      .then(d => (d ? (schema ? schema.parse(d) : d) : undefined));
  }

  /**
   * Push data to ArangoDB, and attempt to intuit the id/key/collection if possible.
   */
  async set(item: Thing): Promise<boolean> {
    const _id = this.getId(item)
    const [_collection, _key] = _id.split('/');

    return await this.collection(_collection)
      .save({ ...item, _id, _key }, { overwriteMode: 'update' })
      .then(() => true);
  }

  /**
   * Push data to ArangoDB, and attempt to intuit the id/key/collection if possible.
   */
  async setText(
    item: string | Thing,
    text: string,
    property = 'text',
    mime = 'text/markdown',
  ): Promise<boolean> {
    const document = this.getId(item);
    const [, key] = document.split('/');

    // Our unique key is a combination of the entity's unique key,
    // the property the text belongs in, and the mimetype of the text.
    // For example:
    // ```
    // {
    //   key: 'episode:rc-01',
    //   property: 'transcript',
    //   mime: 'text/html'
    // }
    // ```
    const _key = uuid({ key, property, mime });

    return await this.collection('text')
      .save({ _key, document, property, mime, text }, { overwriteMode: 'update' })
      .then(() => true);
  }

  /**
   * Push data to ArangoDB, and attempt to intuit the id/key/collection if possible.
   */
  async getText(item: string | Thing, property: 'text', mime = 'text/markdown') {
    const document = this.getKey(item);
    const _key = uuid({ document, property, mime });
    return await this.collection('text')
      .document(_key)
      .then(d => typeof d.text === 'string' ? d.text : d.text.toString());
  }

  /**
   * Push data to ArangoDB, intuiting the correct key/id.
   */
  async link(
    from: string | Thing,
    to: string | Thing,
    rel?: string | Record<string, unknown>,
  ): Promise<boolean> {
    const _from = this.getId(from);
    const _to = this.getId(to);

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
    const _from = this.getId(from);
    const _to = this.getId(to);

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
    const [collection, _key] = this.getId(item);

    return await this.collection(collection)
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
    await Promise.all(
      schemer.getDistinctCollections().map(
        c => this.ensureCollection(c)
      )
    );

    // General use collections that aren't explicit entities 
    await this.ensureCollection('text');
    await this.ensureCollection('embeddings');
    await this.ensureCollection('url');

    await this.ensureEdgeCollection('link');
  }

  async reset(confirm: () => boolean) {
    if (!confirm()) {
      throw new Error('Cannot reset the database without a confirm function.');
    }

    await Promise.all(
      schemer.getDistinctCollections().map(
        c => this.collection(c).truncate()
      )
    );

    // General use collections that aren't explicit entities 
    await this.collection('text').truncate();
    await this.collection('embeddings').truncate();
    await this.collection('url').truncate();

    // And our much-abused links/relationships collection
    await this.collection('link').truncate();
  }

  getId(item: string | Thing) {
    const collection = schemer.getCollection(item);
    const type = schemer.getType(item);
    const key = schemer.getId(item);
    return `${collection}/${type}:${key}`;
  }

  getKey(item: string | Thing) {
    const type = schemer.getType(item);
    const key = schemer.getId(item);
    return `${type}:${key}`;
  }

  getCollection(item: string | Thing) {
    return schemer.getCollection(item);
  }
}
