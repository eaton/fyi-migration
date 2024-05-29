import { toSlug } from "@eatonfyi/text";
import { MarkdownPost } from "../schemas/markdown-post.js";
import { Migrator, MigratorOptions } from "../util/migrator.js";
import { nanoid } from "@eatonfyi/ids";

export interface BlogMigratorOptions extends MigratorOptions {
  commentOutput?: string,
}

/**
 * Common code and defaults for blog posts from a variety of locations.
 * In particular, copying and de-duplicating file assets.
 */
export class BlogMigrator<T = Record<string, unknown>> extends Migrator {
  declare options: BlogMigratorOptions;
  protected queue: T[] = [];

  protected toFilename(date: string | Date | undefined, title: string | undefined, suffix = '.md') {
    const segments = [this.dateToDate(date), title ? toSlug(title.slice(0,32)) : undefined].filter(a => !!a);
    if (segments.length === 0) segments.push(nanoid());
    return segments.join('-') + suffix;
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
