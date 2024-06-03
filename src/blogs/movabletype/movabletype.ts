import { autop, fromTextile, toMarkdown } from '@eatonfyi/html';
import { toSlug } from '@eatonfyi/text';
import { ZodTypeAny, z } from 'zod';
import * as CommentOutput from '../../schemas/comment.js';
import { type MarkdownPost } from '../../schemas/markdown-post.js';
import { BlogMigrator, BlogMigratorOptions } from '../blog-migrator.js';
import * as schemas from './schema.js';
//import { nanohash } from "@eatonfyi/ids";

export interface MovableTypeMigratorOptions extends BlogMigratorOptions {
  authors?: number[];
  blogs?: number[];
}

const defaults: MovableTypeMigratorOptions = {
  name: 'mt',
  label: 'Movable Type',
  input: 'input/blogs/movabletype',
  cache: 'cache/blogs/movabletype',
  output: 'src/entries/',
  authors: [4],
  blogs: [3, 4],
};

export class MovableTypeMigrator extends BlogMigrator<MarkdownPost> {
  declare options: MovableTypeMigratorOptions;

  constructor(options: MovableTypeMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled(): Promise<boolean> {
    return Promise.resolve(this.cache.exists('plugins.json') === 'file');
  }

  override async fillCache(): Promise<void> {
    this.log.debug(`Parsing raw table data`);

    const authors = this.readTableCsv('mt_author.csv', schemas.authorSchema);
    const blogs = this.readTableCsv('mt_blog.csv', schemas.blogSchema);
    const categories = this.readTableCsv(
      'mt_category.csv',
      schemas.categorySchema,
    );
    const entries = this.readTableCsv('mt_entry.csv', schemas.entrySchema);
    const comments = this.readTableCsv('mt_comment.csv', schemas.commentSchema);
    const plugins = this.readTableCsv(
      'mt_plugindata.csv',
      schemas.pluginSchema,
    );

    for (const a of authors) {
      this.cache.write(`authors/${toSlug(a.author_name)}.json`, a);
    }
    for (const b of blogs) {
      this.cache.write(`blogs/${toSlug(b.blog_name)}.json`, b);
    }
    for (const e of entries) {
      this.cache.write(`entries/${e.entry_basename}.json`, e);
    }
    for (const c of comments) {
      this.cache.write(
        `comments/${c.comment_entry_id}-${c.comment_id}.json`,
        c,
      );
    }
    this.cache.write(`categories.json`, categories);
    this.cache.write(`plugins.json`, plugins);
  }

  override async readCache() {
    this.log.debug(`Loading cached data`);

    let authors = this.cache
      .find({ matching: 'authors/*.json' })
      .map(file => this.cache.read(file, 'jsonWithDates') as schemas.Author);
    let blogs = this.cache
      .find({ matching: 'blogs/*.json' })
      .map(file => this.cache.read(file, 'jsonWithDates') as schemas.Blog);
    let entries = this.cache
      .find({ matching: 'entries/*.json' })
      .map(file => this.cache.read(file, 'jsonWithDates') as schemas.Entry);
    const comments = this.cache
      .find({ matching: 'comments/*.json' })
      .map(file => this.cache.read(file, 'jsonWithDates') as schemas.Comment);

    const categories = this.cache.read(
      'categories.json',
      'jsonWithDates',
    ) as schemas.Category[];
    const plugins = this.cache.read(
      'plugins.json',
      'jsonWithDates',
    ) as schemas.Plugin[];

    if (this.options.authors) {
      entries = entries.filter(e =>
        this.options.authors?.includes(e.entry_author_id),
      );
      authors = authors.filter(a =>
        this.options.authors?.includes(a.author_id),
      );
    }

    if (this.options.blogs) {
      blogs = blogs.filter(b => this.options.blogs?.includes(b.blog_id));
    }

    for (const e of entries) {
      e.comments = comments.filter(c => c.comment_entry_id === e.entry_id);
    }

    for (const b of blogs) {
      b.categories = categories.filter(c => c.category_blog_id === b.blog_id);
      b.entries = entries.filter(e => e.entry_blog_id === b.blog_id);
    }

    return Promise.resolve({
      authors,
      blogs,
      plugins,
    });
  }

  override async finalize(): Promise<void> {
    const cache = await this.readCache();
    const siteStore = this.data.bucket('sources');
    const commentStore = this.data.bucket('comments');

    for (const b of cache.blogs) {
      siteStore.set(b.blog_shortname ?? 'movabletype', {
        id: b.blog_shortname ?? 'movabletype',
        title: b.blog_name,
        url: b.blog_site_url,
        slogan: b.blog_description,
        software: 'Movable Type',
        hosting: 'Site5 Hosting',
      });

      for (const e of b.entries ?? []) {
        const text = [e.entry_text, e.entry_text_more]
          .filter(e => e.length > 0)
          .join('\n\n');
        const category =
          b.categories?.find(c => c.category_id === e.entry_category_id)
            ?.category_label || undefined;

        const md = {
          data: {
            id: `${b.blog_shortname}-${e.entry_id}`,
            date: e.entry_created_on.toISOString(),
            title: e.entry_title,
            slug: toSlug(e.entry_title),
            path: e.entry_basename,
            category,
          },
          content: toMarkdown(autop(fromTextile(text))),
        };

        // Prep comments
        const mappedComments = (e.comments ?? []).map(c => {
          const comment: CommentOutput.Comment = {
            id: `mt-c${c.comment_entry_id}`,
            about: md.data.id,
            date: c.comment_created_on,
            author: {
              name: c.comment_author,
              mail: c.comment_email,
              url: c.comment_url,
            },
            body: toMarkdown(autop(fromTextile(c.comment_text))),
          };
          return comment;
        });

        const prefix = b.blog_shortname || this.options.name || 'movabletype';
        const file =
          prefix + '/' + this.toFilename(md.data.date, md.data.title);
        try {
          this.output.write(file, md);
          this.log.debug(`Wrote ${file}`);
          if (mappedComments.length) {
            commentStore.set(md.data.id, mappedComments);
            this.log.debug(
              `Saved ${mappedComments.length} comments for ${md.data.id}`,
            );
          }
        } catch (error: unknown) {
          this.log.error(error, `Failure writing ${file}`);
        }
      }
    }

    // Save blogroll links
    await this.copyAssets('files', 'positiva');
    return Promise.resolve();
  }

  protected readTableCsv<T extends ZodTypeAny>(file: string, schema: T) {
    const raw = (this.input.read('tables/' + file, 'auto') as unknown[]) ?? [];
    return raw.map(u => schema.parse(u) as z.infer<T>);
  }
}
