import { Migrator, MigratorOptions } from "../shared/migrator.js";
import { parseMdbTable, getMdbInfo } from "../helpers/parse-mdb.js";
import { z } from "zod";
import { parse as parsePath } from "path";

export interface AccessMigratorOptions extends MigratorOptions {
  file?: string;
  table?: string;
  schema?: z.ZodTypeAny
}

const defaults: AccessMigratorOptions = {
  name: 'access',
  label: 'MS Access Database',
  input: 'input/datasets/access',
  cache: 'cache/datasets'
}

export class AccessMigrator extends Migrator {
  declare options: AccessMigratorOptions;

  constructor(options: AccessMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async fillCache() {
    for (const mdb of this.input.find({ matching: '*.mdb' })) {
      const dbName = parsePath(mdb).name;
      const data = getMdbInfo(this.input.path(mdb));
      const dbDir = this.cache.dir(dbName);
      for (const t of data.tables) {
        dbDir.write(`${t}.ndjson`, parseMdbTable(this.input.path(mdb), t))
      }
    }

    return;
  }
}