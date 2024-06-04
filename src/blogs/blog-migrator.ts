import { Migrator, MigratorOptions } from '../shared/migrator.js';
import { toShortDate } from '../util/to-short-date.js';
export interface BlogMigratorOptions extends MigratorOptions {
  commentOutput?: string;
}

/**
 * Common code and defaults for blog posts from a variety of locations.
 * In particular, copying and de-duplicating file assets.
 */
export class BlogMigrator extends Migrator {
  declare options: BlogMigratorOptions;

  toShortDate = toShortDate;

  /**
   * Given a set of URL mapping rules, fix links to things we know
   * have been relocated.
   */
  fixLinks(input: string) {
    return input;
  }
}
