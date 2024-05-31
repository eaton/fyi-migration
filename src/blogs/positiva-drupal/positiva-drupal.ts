import { BlogMigrator, BlogMigratorOptions } from "../blog-migrator.js";
import * as schemas from "./schema.js";
import { type MarkdownPost } from "../../schemas/markdown-post.js";
import { z, ZodTypeAny } from 'zod';
import { autop, toMarkdown } from "@eatonfyi/html";
import { toSlug } from "@eatonfyi/text";
import { nanohash } from "@eatonfyi/ids";
import { normalize } from "@eatonfyi/urls";

const defaults: BlogMigratorOptions = {
  name: 'vp-drupal',
  label: 'Via Positiva (Drupal)',
  input: 'input/blogs/viapositiva-drupal',
  cache: 'cache/blogs/vp-drupal',
  output: 'src/entries/viapositiva',
}

export class PositivaDrupalMigrator extends BlogMigrator<MarkdownPost> {

  constructor(options: BlogMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled(): Promise<boolean> {
    return Promise.resolve(this.cache.exists('variables.json') === 'file');
  }

  override async fillCache(): Promise<void> {
    // Start with the tables proper

    this.log.debug('Assembling Node data');
    const nodes = this.readTableCsv('node.csv', schemas.positivaNodeSchema);
    const fields = {
      links: this.readTableCsv('node_link.csv', schemas.linkSchema),
      amazon: this.readTableCsv('node_amazon.csv', schemas.amazonSchema),
      photo: this.readTableCsv('node_photo.csv', schemas.photoSchema),
      quote: this.readTableCsv('node_quote.csv', schemas.quoteSchema),
      files: this.readTableCsv('node_files.csv', schemas.fileSchema),
    }

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
    const comments = this.readTableCsv('comment.csv', schemas.commentSchema);
    for (const c of comments) {
      if (!c.status) continue;
      if (c.spam) continue;
      if (!approvedNodes.has(c.nid)) continue;
      this.cache.write(`comments/${c.nid}-${c.cid}.json`, c);
    }

    const paths = this.readTableCsv('url_alias.csv', schemas.aliasSchema);
    this.cache.write(`paths.json`, paths);

    const vars = Object.fromEntries(this.readTableCsv('variable.csv', schemas.variableSchema).map(e => [e.name, e.value]));
    this.cache.write(`variables.json`, vars);
    return Promise.resolve();
  }

  protected readTableCsv<T extends ZodTypeAny>(file: string, schema: T) {
    const raw = this.input.read('tables/' + file, 'auto') as unknown[] ?? [];
    return raw.map(u => schema.parse(u) as z.infer<T>) ;
  }

  override async readCache() {
    const nodes = this.cache.find({ matching: 'nodes/*.json' }).map(f => this.cache.read(f, 'jsonWithDates') as schemas.Node);
    const comments = this.cache.find({ matching: 'comments/*.json' }).map(f => this.cache.read(f, 'auto') as schemas.Comment);
    const vars = this.cache.read('variables.json', 'jsonWithDates') as Record<string, unknown>;

    const slugs = Object.fromEntries(
      (this.cache.read('paths.json', 'jsonWithDates') as { src: string, dest: string }[])
        .map(a => [a.src, a.dest])
    );
    
    return Promise.resolve({ nodes, comments, vars, slugs });
  }

  override async finalize(): Promise<void> {
    const cache = await this.readCache();
    const quoteStore = this.data.bucket('quotes');
    const linkStore = this.data.bucket('links');

    for (const n of cache.nodes) {

      if (n.type === 'weblink' && n.link?.url !== undefined) {
        const link = {
          url: normalize(n.link.url),
          date: n.created || undefined,
          title: n.title,
          description: toMarkdown(autop(n.body ?? '')),
          source: this.options.name,
        };
        this.log.debug(`Wrote ${link.url}`);
        linkStore.set(nanohash(link.url), link)

      } else if (n.type === 'quotes') {
        const quote = {
          date: n.created || undefined,
          content: toMarkdown(autop(n.body ?? '')),
          attribution: n.quote?.author ?? undefined,
          source: this.options.name,
        };
        this.log.debug(`Wrote quote by ${quote.attribution}`);
        quoteStore.set(nanohash(quote.content), quote)

      } else if (n.type === 'blog' || n.type === 'review') {
        // TODO: entries vs notes
        const md = {
          data: {
            id: `positiva-drupal-${n.nid}`,
            type: n.type,
            date: n.created,
            title: n.title,
            slug: toSlug(n.title),
            path: cache.slugs[`node/${n.nid}`] ?? `node/${n.nid}`,
            about: n.amazon ? 'book/' + n.amazon.asin : undefined,
          },
          content: toMarkdown(autop(n.body ?? '')),
        }
        md.content = this.fixInlineImages(md.content); // Need to pass in the array of files, too
        const file = this.toFilename(md.data.date, md.data.title);
        this.output.write(file, n);
        this.log.debug(`Wrote ${file}`);
      }
    }

    this.data.bucket('sites').set('positiva-drupal', {
      id: 'positiva-drupal',
      title: 'Via Positiva (Drupal)',
      url: 'https://jeff.viapositiva.net',
      slogan: cache.vars['site_slogan'] || undefined,
      software: 'Drupal 5',
      hosting: 'Site5 Hosting'
    });

    this.copyAssets('files', 'positiva');


    // Skip comments for now
    const comments = cache.comments.map(c => ({
      data: {
        
      },
      content: toMarkdown(autop(c.comment ?? '')),
    }));
    return Promise.resolve();
  }

  fixInlineImages(body: string, images: Record<string, string>[] = []) {
    return body;
  }
}