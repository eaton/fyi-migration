import { BlogMigrator, BlogMigratorOptions } from "../blog-migrator.js";
import * as schemas from "./schema.js";
import { type MarkdownPost } from "../../schemas/markdown-post.js";
// import { autop, toMarkdown } from "@eatonfyi/html";
// import { toSlug } from "@eatonfyi/text";
import { z, ZodTypeAny } from 'zod';
import { autop, toMarkdown } from "@eatonfyi/html";

export interface DrupalMigratorOptions extends BlogMigratorOptions {
  comments?: boolean,
  nodeTypes?: string[]
  uids?: number[]
}

const defaults: DrupalMigratorOptions = {
  name: 'goddy',
  label: 'Growing Up Goddy',
  description: 'The Goddy Blog',
  input: 'input/blogs/goddy',
  cache: 'cache/blogs/goddy',
  output: 'src/entries/goddy',
  comments: true,
  uids: [2]
}

export class GoddyMigrator extends BlogMigrator<MarkdownPost> {
  declare options: DrupalMigratorOptions;

  constructor(options: DrupalMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled(): Promise<boolean> {
    return false
    return Promise.resolve(this.cache.exists('variables.json') === 'file');
  }

  override async fillCache(): Promise<void> {
    // Start with the tables proper

    this.log.debug('Assembling Node data');
    const nodes = this.readTableCsv('node.csv', schemas.goddyNodeSchema);
    const nodeBodies = this.readTableCsv('field_data_body.csv', schemas.bodySchema);
    const fields = {
      links: this.readTableCsv('field_data_field_link.csv', schemas.linkSchema),
      products: this.readTableCsv('field_data_field_product.csv', schemas.productSchema),
      moneyQuotes: this.readTableCsv('field_data_field_money_quote.csv', schemas.moneyQuoteSchema),
      uploads: this.readTableCsv('field_data_upload.csv', schemas.uploadSchema),
    }

    const asins = this.readTableCsv('amazon_item.csv', schemas.asinItemSchema);
    const participants = this.readTableCsv('amazon_item_participant.csv', schemas.asinParticipantSchema);
    const books = this.readTableCsv('amazon_book.csv', schemas.asinBookSchema);

    for (const asin of fields.products) {
      asin.participants = participants.filter(p => p.asin === asin.field_product_asin);
      asin.item = asins.find(p => p.asin === asin.field_product_asin);
      asin.book = books.find(p => p.asin === asin.field_product_asin);
    }

    const approvedNodes = new Set<number>();
    for (const n of nodes) {
      if (this.options.uids && !this.options.uids.includes(n.uid)) continue;
      if (this.options.nodeTypes && !this.options.nodeTypes.includes(n.type)) continue;

      approvedNodes.add(n.nid);
      n.body = nodeBodies.find(f => f.entity_type === 'node' && f.entity_id === n.nid)?.body_value;
      n.money_quote = fields.moneyQuotes.find(f => f.entity_type === 'node' && f.entity_id === n.nid);
      n.link = fields.links.find(f => f.entity_type === 'node' && f.entity_id === n.nid);
      n.product = fields.products.find(f => f.entity_type === 'node' && f.entity_id === n.nid);
      n.uploads = fields.uploads.filter(f => f.entity_type === 'node' && f.entity_id === n.nid);

      this.cache.write(`node-${n.type}-${n.nid}.json`, n);
    }

    this.log.debug('Assembling Comment data');
    const comments = this.readTableCsv('comment.csv', schemas.commentSchema);
    const commentBodies = this.readTableCsv('field_data_comment_body.csv', schemas.commentBodySchema);
    for (const c of comments) {
      if (!c.status) continue;
      if (!approvedNodes.has(c.nid)) continue;

      c.body = commentBodies.find(f => f.entity_type === 'comment' && f.entity_id === c.cid)?.comment_body_value;
      this.cache.write(`comment-${c.cid}.json`, c);
    }

    const users = this.readTableCsv('users.csv', schemas.userSchema);
    for (const u of users) {
      if (this.options.uids && !this.options.uids.includes(u.uid)) continue;
      this.cache.write(`user-${u.uid}.json`, u);
    }

    const paths = this.readTableCsv('url_alias.csv', schemas.aliasSchema);
    this.cache.write(`paths.json`, paths);

    const vars = Object.fromEntries(this.readTableCsv('variable.csv', schemas.variableSchema).map(e => [e.name, e.value]));
    this.cache.write(`variables.json`, vars);
  }

  protected readTableCsv<T extends ZodTypeAny>(file: string, schema: T) {
    const raw = this.input.read('tables/' + file, 'auto') as unknown[] ?? [];
    return raw.map(u => schema.parse(u) as z.infer<T>) ;
  }

  override async readCache() {
    const nodes = this.cache.find({ matching: 'node-*.json' }).map(f => this.cache.read(f, 'auto') as schemas.GoddyNode);
    const comments = this.cache.find({ matching: 'comment-*.json' }).map(f => this.cache.read(f, 'auto') as schemas.GoddyComment);
    const vars = this.cache.read('variables.json', 'auto') as Record<string, unknown>;

    for (const n of nodes) {
      if (n.type === 'site') {
        // save links
      } else if (n.type === 'review') {
        // save book records
      }
    }

    return Promise.resolve({ nodes, comments, vars });
  }

  override async process(): Promise<void> {
    const cache = await this.readCache();

    const nodes = cache.nodes.map(n => ({
      data: {
        id: '',
        date: '',
        title: '',
        slug: '',
      },
      content: toMarkdown(autop(n.body ?? '')),
    }));

    const comments = cache.comments.map(c => ({
      data: {

      },
      content: toMarkdown(autop(c.body ?? '')),
    }));

    const site = {
      id: 'goddy',
      title: 'Growing Up Goddy',
      url: 'https://growingupgoddy.com',
      slogan: cache.vars['site_slogan'] || undefined,
      software: 'Drupal 6',
      hosting: 'Linode'
    }
  }

  override async finalize(): Promise<void> {
    this.copyAssets('files', 'goddy');
  }
}