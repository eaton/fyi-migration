import { autop, toMarkdown } from '@eatonfyi/html';
import { toSlug } from '@eatonfyi/text';
import { ZodTypeAny, z } from 'zod';
import { Bookmark } from '../../schemas/custom/bookmark.js';
import { CommentSchema } from '../../schemas/schema-org/CreativeWork/comment.js';
import { SocialMediaPostingSchema } from '../../schemas/schema-org/CreativeWork/social-media-post.js';
import {
  CreativeWork,
  CreativeWorkSchema,
} from '../../schemas/schema-org/creative-work.js';
import { toId } from '../../shared/schemer.js';
import { prepUrlForBookmark } from '../../util/clean-link.js';
import { sortByParents } from '../../util/parent-sort.js';
import { BlogMigrator, BlogMigratorOptions } from '../blog-migrator.js';
import * as drupal from './schema.js';

export interface DrupalMigratorOptions extends BlogMigratorOptions {
  comments?: boolean;
  nodeTypes?: string[];
  uids?: number[];
}

const defaults: DrupalMigratorOptions = {
  name: 'goddy',
  label: 'Growing Up Goddy',
  description: 'The Goddy Blog',
  input: 'input/blogs/goddy',
  cache: 'cache/blogs/goddy',
  output: 'src/entries/goddy',
  comments: true,
  nodeTypes: ['blog', 'review', 'site', 'page'],
  uids: [2],
};

export class GoddyMigrator extends BlogMigrator {
  declare options: DrupalMigratorOptions;

  constructor(options: DrupalMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled(): Promise<boolean> {
    return Promise.resolve(this.cache.exists('variables.json') === 'file');
  }

  override async fillCache(): Promise<void> {
    // Start with the tables proper

    this.log.debug('Assembling Node data');
    const nodes = this.readTableCsv('node.csv', drupal.goddyNodeSchema);
    const nodeBodies = this.readTableCsv(
      'field_data_body.csv',
      drupal.bodySchema,
    );
    const fields = {
      links: this.readTableCsv('field_data_field_link.csv', drupal.linkSchema),
      products: this.readTableCsv(
        'field_data_field_product.csv',
        drupal.productSchema,
      ),
      moneyQuotes: this.readTableCsv(
        'field_data_field_money_quote.csv',
        drupal.moneyQuoteSchema,
      ),
      uploads: this.readTableCsv('field_data_upload.csv', drupal.uploadSchema),
    };

    const asins = this.readTableCsv('amazon_item.csv', drupal.asinItemSchema);
    const participants = this.readTableCsv(
      'amazon_item_participant.csv',
      drupal.asinParticipantSchema,
    );
    const books = this.readTableCsv('amazon_book.csv', drupal.asinBookSchema);

    for (const asin of fields.products) {
      asin.participants = participants.filter(
        p => p.asin === asin.field_product_asin,
      );
      asin.item = asins.find(p => p.asin === asin.field_product_asin);
      asin.book = books.find(p => p.asin === asin.field_product_asin);
    }

    const approvedNodes = new Set<number>();
    for (const n of nodes) {
      if (this.options.uids && !this.options.uids.includes(n.uid)) continue;
      if (this.options.nodeTypes && !this.options.nodeTypes.includes(n.type))
        continue;

      approvedNodes.add(n.nid);
      n.body = nodeBodies.find(
        f => f.entity_type === 'node' && f.entity_id === n.nid,
      )?.body_value;
      n.money_quote = fields.moneyQuotes.find(
        f => f.entity_type === 'node' && f.entity_id === n.nid,
      );
      n.link = fields.links.find(
        f => f.entity_type === 'node' && f.entity_id === n.nid,
      );
      n.product = fields.products.find(
        f => f.entity_type === 'node' && f.entity_id === n.nid,
      );
      n.uploads = fields.uploads.filter(
        f => f.entity_type === 'node' && f.entity_id === n.nid,
      );

      this.cache.write(`node-${n.type}-${n.nid}.json`, n);
    }

    this.log.debug('Assembling Comment data');
    const comments = this.readTableCsv('comment.csv', drupal.commentSchema);
    const commentBodies = this.readTableCsv(
      'field_data_comment_body.csv',
      drupal.commentBodySchema,
    );
    for (const c of comments) {
      if (!c.status) continue;
      if (!approvedNodes.has(c.nid)) continue;
      c.body = commentBodies.find(
        f => f.entity_type === 'comment' && f.entity_id === c.cid,
      )?.comment_body_value;
      this.cache.write(`comment-${c.cid}.json`, c);
    }

    const users = this.readTableCsv('users.csv', drupal.userSchema);
    for (const u of users) {
      if (this.options.uids && !this.options.uids.includes(u.uid)) continue;
      this.cache.write(`user-${u.uid}.json`, u);
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

  override async readCache() {
    const nodes = this.cache
      .find({ matching: 'node-*.json' })
      .map(f => this.cache.read(f, 'jsonWithDates') as drupal.GoddyNode);
    const comments = this.cache
      .find({ matching: 'comment-*.json' })
      .map(f => this.cache.read(f, 'jsonWithDates') as drupal.GoddyComment);
    const vars = this.cache.read('variables.json', 'jsonWithDates') as Record<
      string,
      unknown
    >;

    const slugs = Object.fromEntries(
      (
        this.cache.read('paths.json', 'jsonWithDates') as {
          source: string;
          alias: string;
        }[]
      ).map(a => [a.source, a.alias]),
    );
    return Promise.resolve({ nodes, comments, vars, slugs });
  }

  override async finalize(): Promise<void> {
    const cache = await this.readCache();

    // Prep the comments first, so they're easier to attach to the nodes.
    const comments = cache.comments.map(c => this.prepComment(c));
    const nodes = cache.nodes.map(n => this.prepEntry(n));

    for (const node of nodes) {
      await this.saveThing(node);
      await this.saveThing(node, 'markdown');

      const nodeComments = comments.filter(c => c.about === node.id);
      if (nodeComments.length) {
        sortByParents(nodeComments);
        await this.saveThings(nodeComments);
        this.log.debug(`Saved ${nodeComments.length} comments for ${node.id}`);
      }
    }

    const site = CreativeWorkSchema.parse({
      type: 'Blog',
      id: toId('blog', this.name),
      url: 'https://growingupgoddy.com',
      name: cache.vars['site_name'] || this.label,
      subtitle: cache.vars['site_slogan'] || undefined,
      software: 'Drupal 6',
      hosting: 'Linode',
    });
    await this.saveThing(site);

    await this.copyAssets('files', 'goddy');
    return;
  }

  protected readTableCsv<T extends ZodTypeAny>(file: string, schema: T) {
    const raw = (this.input.read('tables/' + file, 'auto') as unknown[]) ?? [];
    return raw.map(u => schema.parse(u) as z.infer<T>);
  }

  protected prepEntry(input: drupal.GoddyNode): CreativeWork | Bookmark {
    if (input.link?.field_link_url) {
      return SocialMediaPostingSchema.parse({
        ...prepUrlForBookmark(input.link?.field_link_url),
        title: input.title,
        isPartOf: toId('blog', this.name),
        description: toMarkdown(autop(input.summary ?? '')) || undefined,
        date: input.created,
      });
    } else {
      return CreativeWorkSchema.parse({
        type: 'BlogPosting',
        id: toId('post', `gdy${input.nid}`),
        date: input.created,
        name: input.title,
        slug: toSlug(input.title),
        description: input.summary,
        isPartOf: toId('blog', this.name),
        quote: input.money_quote
          ? toMarkdown(autop(input.money_quote.field_money_quote_value))
          : undefined,
        about:
          (input.product
            ? toId('book', input.product.field_product_asin?.trim())
            : undefined) ??
          input.link?.field_link_url ??
          undefined,
        text: toMarkdown(autop(input.body ?? '')),
        nodeType: input.type,
      });
    }
  }

  protected prepComment(input: drupal.GoddyComment): CreativeWork {
    return CommentSchema.parse({
      id: toId('comment', `gdy${input.cid}`),
      about: toId('post', `gdy${input.nid}`),
      parent: input.pid ? toId('comment', `gdy${input.pid}`) : undefined,
      thread: undefined, // Set it later manually
      date: input.created,
      commenter: {
        name: input.name,
        mail: input.mail,
        url: input.homepage,
      },
      isPartOf: toId('blog', this.name),
      name: input.subject,
      text: toMarkdown(autop(input.body ?? '')),
    });
  }
}
