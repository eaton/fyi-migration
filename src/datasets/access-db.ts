import { Migrator, MigratorOptions } from "../shared/migrator.js";
import { parseMdbFile, parseMdbTable, getMdbInfo } from "../helpers/parse-mdb.js";
import { z } from "zod";

export interface AccessMigratorOptions extends MigratorOptions {
  file?: string;
  table?: string;
  schema?: z.ZodTypeAny
}

const defaults: AccessMigratorOptions = {
  name: 'access',
  label: 'MS Access Databases',
  input: 'input/datasets',
  cache: 'cache/datasets'
}

export class AccessMigrator extends Migrator {
  declare options: AccessMigratorOptions;

  constructor(options: AccessMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }
}