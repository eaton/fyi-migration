import { autop, toMarkdown } from '@eatonfyi/html';
import { nanohash } from '@eatonfyi/ids';
import { removeStopwords, toSlug } from '@eatonfyi/text';
import { normalize } from '@eatonfyi/urls';
import { ZodTypeAny, z } from 'zod';
import { Comment, CommentSchema } from '../../schemas/comment.js';
import { BlogMigrator, BlogMigratorOptions } from '../blog-migrator.js';
import * as drupal from './schema.js';
import { CreativeWork, CreativeWorkSchema } from '../../schemas/creative-work.js';

const defaults: BlogMigratorOptions = {
  name: 'vp-drupal',
  label: 'Via Positiva (Drupal)',
  input: 'input/blogs/viapositiva-drupal',
  cache: 'cache/blogs/vp-drupal',
  output: 'src/entries/positiva-drupal',
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
    const comments = this.readTableCsv('comment.csv', drupal.commentSchema);
    for (const c of comments) {
      if (!c.status) continue;
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
    const quoteStore = this.data.bucket('quotes');
    const linkStore = this.data.bucket('links');
    const commentStore = this.data.bucket('comments');

    for (const n of cache.nodes) {
      if (n.type === 'weblink' && n.link?.url !== undefined) {
        const link = this.prepLink(n);
        linkStore.set(link.id, link);
        this.log.debug(`Wrote link to ${link.url}`);
      } else if (n.type === 'quotes') {
        const quote = this.prepQuote(n);
        quoteStore.set(quote.id, quote);
        this.log.debug(`Wrote quote by ${quote.spokenBy}`);
      } else if (n.type === 'blog' || n.type === 'review') {
        // TODO: entries vs notes
        const { text, ...frontmatter} = this.prepEntry(n);
        const file = this.toFilename(frontmatter);
        this.output.write(file, { content: text, data: frontmatter });

        // Handle comments
        const mappedComments = cache.comments
          .filter(c => c.nid === n.nid)
          .map(c => this.prepComment(c));

        if (mappedComments.length) {
          commentStore.set(frontmatter.id, mappedComments);
          this.log.debug(
            `Saved ${mappedComments.length} comments for ${frontmatter.id}`,
          );
        }
      }
    }

    const site = this.prepSite(cache.vars);
    this.data.bucket('sources').set(site.id, site);

    this.copyAssets('files', 'positiva');
    return Promise.resolve();
  }

  protected prepSite(vars?: Record<string, unknown>) {
    return CreativeWorkSchema.parse({
      id: this.name,
      url: 'https://jeff.viapositiva.net',
      name: vars?.['site_slogan'] || this.label,
      description: vars?.['site_slogan'] || undefined,
      software: 'Drupal 5',
      hosting: 'Site5 Hosting',
    });
  }

  protected prepEntry(input: drupal.Node): CreativeWork {
    return CreativeWorkSchema.parse({
      id: `vpd-${input.nid}`,
      nodeType: input.type,
      date: input.created,
      name: input.title,
      slug: toSlug(input.title),
      isPartOf: this.options.name,
      text: this.buildNodeBody(input),
      about: (input.amazon?.asin) ? input.amazon.asin : undefined
    });
  }

  protected prepLink(input: drupal.Node): CreativeWork {
    return CreativeWorkSchema.parse({
      id: nanohash(input.link!.url!),
      type: 'CreativeWork/Bookmark',
      url: normalize(input.link!.url!),
      date: input.created,
      name: input.title,
      text: this.buildNodeBody(input),
      isPartOf: this.options.name,
    });
  }

  protected prepQuote(input: drupal.Node): CreativeWork {
    const text = toMarkdown(autop(input.body ?? ''));
    const id = nanohash(removeStopwords(text));
    return CreativeWorkSchema.parse({
      id,
      text,
      date: input.created,
      spokenBy: input.quote?.author ?? undefined,
      isBasedOn: undefined,
      recordedIn: undefined,
      isPartOf: this.options.name,
    });
  }

  protected prepComment(input: drupal.Comment): Comment {
    return CommentSchema.parse({
      id: `vpd-c${input.cid}`,
      parent: input.pid ? `vpd-c${input.pid}` : undefined,
      sort: input.thread,
      about: `vpd-${input.nid}`,
      date: input.timestamp,
      author: {
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

  protected fixInlineImages(
    body: string,
    images: z.infer<typeof drupal.fileSchema>[] = [],
  ) {
    if (body.indexOf('[inline') > 0) {
      let tmp = body.replaceAll(/\[inline:(.+)\]/g, '<img src="$1" />');
      for (const img of images) {
        tmp = tmp.replaceAll(img.description ?? '', img.filepath);
      }
      return tmp;
    }
    return body;
  }
}
