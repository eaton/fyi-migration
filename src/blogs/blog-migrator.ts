import { Migrator, MigratorOptions } from "../util/migrator.js";
import { JekyllPost } from "./alt-jekyll/schema.js";

export interface BlogMigratorOptions extends MigratorOptions {
  assetInput?: string,
  assetOutput?: string,
  commentOutput?: string,
}

/**
 * Common code and defaults for blog posts from a variety of locations.
 * In particular, copying and de-duplicating file assets.
 */
export class BlogMigrator<T = JekyllPost> extends Migrator {
  declare options: BlogMigratorOptions;
  protected queue: T[] = [];

  async copyAssets() {
    if (this.options.assetInput && this.options.assetOutput) {
      return this.input.copyAsync(
        this.root.dir(this.options.assetInput).path(),
        this.root.dir(this.options.assetOutput).path(),
        { overwrite: true }
      );
    }
  }

  /**
   * Given a set of URL mapping rules, fix links to things we know
   * have been relocated.
   */
  fixLinks(input: string) {
    return input;
  }
}