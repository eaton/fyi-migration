import { autop, toMarkdown } from '@eatonfyi/html';
import { nanohash } from '@eatonfyi/ids';
import {
  BookmarkSchema,
  Comment,
  CommentSchema,
  CreativeWork,
  CreativeWorkSchema,
  SocialMediaPostingSchema,
  toId,
} from '@eatonfyi/schema';
import { removeStopwords, toSlug } from '@eatonfyi/text';
import is from '@sindresorhus/is';
import { ZodTypeAny, z } from 'zod';
import { prepUrlForBookmark } from '../../util/clean-link.js';
import { sortByParents } from '../../util/parent-sort.js';
import { BlogMigrator, BlogMigratorOptions } from '../blog-migrator.js';
import * as drupal from './schema.js';

const defaults: BlogMigratorOptions = {
  name: 'vp-drupal',
  label: 'Via Positiva (Drupal)',
  input: 'input/blogs/viapositiva-drupal',
  cache: 'cache/blogs/vp-drupal',
  output: 'src/entries/viapositiva',
};

export class PositivaDrupalMigrator extends BlogMigrator {
  constructor(options: BlogMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled(): Promise<boolean> {
    return Promise.resolve(this.cache.exists('variables.json') === 'file');
  }

  override async fillCache(): Promise<void> {
    // Start with the tables proper

    this.log.debug('Assembling Node data');
    const nodes = this.readTableCsv('node.csv', drupal.positivaNodeSchema);
    const fields = {
      links: this.readTableCsv('node_link.csv', drupal.linkSchema),
      amazon: this.readTableCsv('node_amazon.csv', drupal.amazonSchema),
      photo: this.readTableCsv('node_photo.csv', drupal.photoSchema),
      quote: this.readTableCsv('node_quote.csv', drupal.quoteSchema),
      files: this.readTableCsv('node_files.csv', drupal.fileSchema),
    };

    const approvedNodes = new Set<number>();
    for (const n of nodes) {
      approvedNodes.add(n.nid);
      n.photo = fields.photo.find(f => f.nid === n.nid);
      n.quote = fields.quote.find(f => f.nid === n.nid);
      n.link = fields.links.find(f => f.nid === n.nid);
      n.amazon = fields.amazon.find(f => f.nid === n.nid);
      n.files = fields.files.filter(f => f.nid === n.nid);

      this.cache.write(`nodes/${n.type}-${n.nid}.json`, n);
    }

    this.log.debug('Assembling Comment data');
    const comments = this.readTableCsv('comments.csv', drupal.commentSchema);
    for (const c of comments) {
      if (c.status) continue;
      if (c.spam) continue;
      if (!approvedNodes.has(c.nid)) continue;
      this.cache.write(`comments/${c.nid}-${c.cid}.json`, c);
    }

    const paths = this.readTableCsv('url_alias.csv', drupal.aliasSchema);
    this.cache.write(`paths.json`, paths);

    const vars = Object.fromEntries(
      this.readTableCsv('variable.csv', drupal.variableSchema).map(e => [
        e.name,
        e.value,
      ]),
    );
    this.cache.write(`variables.json`, vars);
    return Promise.resolve();
  }

  protected readTableCsv<T extends ZodTypeAny>(file: string, schema: T) {
    const raw = (this.input.read('tables/' + file, 'auto') as unknown[]) ?? [];
    return raw.map(u => schema.parse(u) as z.infer<T>);
  }

  override async readCache() {
    const nodes = this.cache
      .find({ matching: 'nodes/*.json' })
      .map(f => this.cache.read(f, 'jsonWithDates') as drupal.Node);
    const comments = this.cache
      .find({ matching: 'comments/*.json' })
      .map(f => this.cache.read(f, 'auto') as drupal.Comment);
    const vars = this.cache.read('variables.json', 'jsonWithDates') as Record<
      string,
      unknown
    >;

    const slugs = Object.fromEntries(
      (
        this.cache.read('paths.json', 'jsonWithDates') as {
          src: string;
          dest: string;
        }[]
      ).map(a => [a.src, a.dest]),
    );

    return Promise.resolve({ nodes, comments, vars, slugs });
  }

  override async finalize(): Promise<void> {
    const cache = await this.readCache();

    for (const n of cache.nodes) {
      if (n.type === 'weblink' && n.link?.url !== undefined) {
        const link = this.prepLink(n);
        await this.saveThing(link);
      } else if (n.type === 'quotes') {
        const quote = this.prepQuote(n);
        await this.saveThing(quote);
      } else if (n.type === 'blog' || n.type === 'review') {
        const entry = this.prepEntry(n);

        // Handle comments
        const mappedComments = cache.comments
          .filter(c => c.nid === n.nid)
          .map(c => this.prepComment(c));

        if (mappedComments.length) {
          entry.commentCount = mappedComments.length;
          sortByParents(mappedComments);
          await this.saveThings(mappedComments);
        }
        await this.saveThing(entry);
      }
    }

    const site = this.prepSite(cache.vars);
    await this.saveThing(site);

    this.copyAssets('files', 'positiva');
    return Promise.resolve();
  }

  protected prepSite(vars?: Record<string, unknown>) {
    return CreativeWorkSchema.parse({
      type: 'Blog',
      id: toId('blog', this.name),
      url: 'https://jeff.viapositiva.net',
      name: vars?.['site_name'] || this.label,
      subtitle: vars?.['site_slogan'] || undefined,
      software: 'Drupal 5',
      hosting: 'Site5 Hosting',
    });
  }

  protected prepEntry(input: drupal.Node): CreativeWork {
    return SocialMediaPostingSchema.parse({
      type: 'BlogPosting',
      id: toId('post', `vpd-${input.nid}`),
      date: input.created,
      name: input.title,
      slug: toSlug(input.title),
      isPartOf: toId('blog', 'viapositiva'),
      text: this.buildNodeBody(input),
      about: input.amazon?.asin ? 'book:' + input.amazon.asin : undefined,
    });
  }

  protected prepLink(input: drupal.Node): CreativeWork {
    return BookmarkSchema.parse({
      ...prepUrlForBookmark(input.link!.url),
      date: input.created,
      name: input.title,
      description: this.buildNodeBody(input) || undefined,
      isPartOf: toId('blog', 'viapositiva'),
    });
  }

  protected prepQuote(input: drupal.Node): CreativeWork {
    const text = toMarkdown(autop(input.body ?? ''));
    const id = toId('quote', nanohash(removeStopwords(text)));
    return CreativeWorkSchema.parse({
      type: 'Quotation',
      id,
      text,
      date: input.created,
      spokenBy: input.quote?.author ?? undefined,
      isBasedOn: undefined,
      recordedIn: undefined,
      isPartOf: toId('blog', 'viapositiva'),
    });
  }

  protected prepComment(input: drupal.Comment): Comment {
    return CommentSchema.parse({
      type: 'Comment',
      id: toId('comment', `vp${input.cid}d`),
      parent: input.pid ? toId('comment', `vp${input.pid}d`) : undefined,
      thread: undefined, // set it again later
      about: toId('post', `vp${input.nid}`),
      date: input.timestamp,
      isPartOf: toId('blog', 'viapositiva'),
      commenter: {
        name: input.name,
        mail: input.mail,
        url: input.homepage,
      },
      name: input.subject,
      text: toMarkdown(autop(input.comment ?? '')),
    });
  }

  protected buildNodeBody(input: drupal.Node): string {
    let text = autop(input.body ?? '');
    text = this.fixInlineImages(text, input.files);
    text = toMarkdown(text);
    return text;
  }

  /**
   * This should catch three scenarios:
   *
   * 1. `[inline:1]` placeholders for attached images in node bodies; it should replace the digit
   *    with the nth image from the images array.
   * 2. `[inline:foo.jpg]` paths for filename references.
   * 3. `<img src="sites/all/files/foo.jpg" />` style links to local images that have now moved.
   */
  protected fixInlineImages(
    body: string,
    images: z.infer<typeof drupal.fileSchema>[] = [],
  ) {
    if (body.indexOf('[inline') > 0) {
      const inlines = [...body.matchAll(/\[inline:(.+)\]/g)];
      for (const inline of inlines) {
        const img = inline[1];
        if (is.numericString(img)) {
          const idx = Number.parseInt(img) - 1;
          body.replace(inline[0], `<img src="${images[idx].filepath}" />`);
        }
      }
      for (const img of images) {
        if (img.description) {
          body = body.replaceAll(img.description, img.filepath);
        }
      }
    }
    return body;
  }
}
