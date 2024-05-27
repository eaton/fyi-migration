import { Database } from 'arangojs';
import { CreateCollectionOptions } from 'arangojs/collection';
import { Config } from 'arangojs/connection';

export class Arango {
  db: Database;

  /**
   * Given ArangoDB connection information and a specific databaseName,
   * attempts to connect. If the database does not exist, it attempts
   * to connect to the _system database, create the named database,
   * and return the named database.
   */
  static async ensureDatabase(input: Config & { databaseName: string }) {
    const { databaseName, ...config } = input;

    const db = new Database(config);
    
    if (await db.database(databaseName).exists()) {
      return new Arango(db);
    } else {
      const newDb = await db.createDatabase(databaseName);
      return new Arango(newDb);
    }
  }

  constructor(input: Config | Database) {
    if (input instanceof Database) {
      this.db = input;
    } else {
      this.db = new Database(input);
    }
  };

  /**
   * Returns a promise resolving to the named collection; the collection will
   * be created if it does not already exist.
   */
  async ensure(name: string, options: CreateCollectionOptions & { type?: string } = {} ) {
    const { type, ...opt } = options;

    return this.db.collection(name)
      .exists()
      .then(async exists => {
        if (exists) {
          return this.db.collection(name);
        } else if (type === 'edge') {
          return this.db.createEdgeCollection(name, options);
        } else {
          return this.db.createCollection(name, opt);
        }
      });
  }

  /**
   * Removes all documents in a specific collection, returning a promise that
   * resolves to the number of documents that were deleted. If the collection
   * did not exist, the number of removed documents will be -1.
   */
  async empty(name: string) {
    return this.db.collection(name)
      .exists()
      .then((exists) => {
        if (exists) {
          return this.db.collection(name)
            .count()
            .then((count) =>
              this.db.collection(name)
                .truncate()
                .then(() => count.count)
            );
        } else {
          return -1;
        }
      });
  }

  /**
   * Deletes the named collection from the database, returning a promise that
   * resolves to the number of documents in the deleted colleciton. If the collection
   * did not exist, the number of removed documents will be -1.
   */
  async destroy(name: string) {
    return this.db.collection(name)
      .exists()
      .then((exists) => {
        if (exists) {
          return this.db.collection(name)
            .count()
            .then((count) =>
              this.db.collection(name)
                .drop()
                .then(() => count.count)
            );
        } else {
          return -1;
        }
      });
  }
}