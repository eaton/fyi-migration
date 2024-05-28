import { MarkdownPost } from "../schemas/markdown-post.js";
import { Migrator, MigratorOptions } from "../util/migrator.js";

export interface BlogMigratorOptions extends MigratorOptions {
  assetInput?: string,
  assetOutput?: string,
  commentOutput?: string,
}

/**
 * Common code and defaults for blog posts from a variety of locations.
 * In particular, copying and de-duplicating file assets.
 */
export class BlogMigrator<T = Record<string, unknown>> extends Migrator {
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

  protected dateToDate(input: string | Date | undefined) {
    if (typeof input === 'string') return input.split('T')[0];
    return input?.toISOString()?.split('T')[0];
  }

  protected prepMarkdownFile(input: T): MarkdownPost | undefined {
    if (input) return undefined;
    else return undefined;
  }

  /**
   * Given a set of URL mapping rules, fix links to things we know
   * have been relocated.
   */
  fixLinks(input: string) {
    return input;
  }
}