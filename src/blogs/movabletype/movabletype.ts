import { autop, fromTextile, toMarkdown } from '@eatonfyi/html';
import { toSlug } from '@eatonfyi/text';
import { ZodTypeAny, z } from 'zod';
import { CommentSchema } from '../../schemas/comment.js';
import {
  CreativeWork,
  CreativeWorkSchema,
} from '../../schemas/creative-work.js';
import { BlogMigrator, BlogMigratorOptions } from '../blog-migrator.js';
import * as schemas from './schema.js';

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

export class MovableTypeMigrator extends BlogMigrator {
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
      e.comments = comments.filter(c => c.comment_entry_id === e.entry_id && c.comment_blog_id == e.entry_blog_id);
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
    const thingStore = this.data.bucket('things');
    const commentStore = this.data.bucket('comments');

    for (const blog of cache.blogs) {
      const site = this.prepSite(blog);
      thingStore.set(site.id, site);

      for (const entry of blog.entries ?? []) {
        const category = blog.categories?.find(
          c => c.category_id === entry.entry_category_id,
        );

        const { text, ...frontmatter } = this.prepEntry(entry, blog, category);
        const mappedComments = (entry.comments ?? []).map(c =>
          this.prepComment(c, frontmatter),
        );

        const file = [site.id, this.makeFilename(frontmatter)].join('/');
        this.output.write(file, { content: text, data: frontmatter });
        if (this.options.store == 'arango') {
          await this.arango.set({ ...frontmatter, text });
        }
        this.log.debug(`Wrote ${file}`);

        if (mappedComments.length) {
          commentStore.set(frontmatter.id, mappedComments);
          if (this.options.store === 'arango') {
            for (const c of mappedComments) {
              c.isPartOf = frontmatter.isPartOf;
              await this.arango.set(c);
            }
          }

          this.log.debug(
            `Saved ${mappedComments.length} comments for ${frontmatter.id}`,
          );
        }
      }
    }
    await this.copyAssets('files', 'positiva');
    return Promise.resolve();
  }

  protected prepSite(input: schemas.Blog) {
    return CreativeWorkSchema.parse({
      type: 'Blog',
      id: input.blog_shortname ?? this.options.name,
      url: input.blog_site_url,
      name: input.blog_name,
      subtitle: input.blog_description,
      software: 'Movable Type',
      hosting: 'Site5 Hosting',
    });
  }

  protected prepEntry(
    input: schemas.Entry,
    blog: schemas.Blog,
    category?: schemas.Category,
  ): CreativeWork {
    const text = [input.entry_text, input.entry_text_more]
      .filter(e => e.length > 0)
      .join('\n\n');

    const entry = CreativeWorkSchema.parse({
      id: `mt-${input.entry_id}`,
      type: 'BlogPosting',
      date: input.entry_created_on.toISOString(),
      name: input.entry_title,
      slug: input.entry_basename,
      isPartOf: blog.blog_shortname ?? this.name,
      text: toMarkdown(fromTextile(text)),
      keywords: category ? [category.category_label] : undefined,
    });

    return entry;
  }

  protected prepComment(input: schemas.Comment, entry: CreativeWork) {
    return CommentSchema.parse({
      id: `mt-c${input.comment_entry_id}`,
      date: input.comment_created_on,
      about: entry.id,
      commenter: {
        name: input.comment_author || undefined,
        mail: input.comment_email || undefined,
        url: input.comment_url || undefined,
      },
      text: toMarkdown(autop(fromTextile(input.comment_text))),
    });
  }

  protected readTableCsv<T extends ZodTypeAny>(file: string, schema: T) {
    const raw = (this.input.read('tables/' + file, 'auto') as unknown[]) ?? [];
    return raw.map(u => schema.parse(u) as z.infer<T>);
  }
}
