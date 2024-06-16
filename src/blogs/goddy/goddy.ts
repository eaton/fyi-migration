import { autop, toMarkdown } from '@eatonfyi/html';
import { toSlug } from '@eatonfyi/text';
import { ZodTypeAny, z } from 'zod';
import { Bookmark, BookmarkSchema } from '../../schemas/bookmark.js';
import { CommentSchema } from '../../schemas/comment.js';
import {
  CreativeWork,
  CreativeWorkSchema,
} from '../../schemas/creative-work.js';
import { prepUrlForBookmark } from '../../util/clean-link.js';
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
    const commentStore = this.data.bucket('comments');
    const linkStore = this.data.bucket('links');

    // Prep the comments first, so they're easier to attach to the nodes.
    const comments = cache.comments.map(c => this.prepComment(c));
    const nodes = cache.nodes.map(n => this.prepEntry(n));

    for (const { text, ...frontmatter } of nodes) {
      if (frontmatter.type === 'Bookmark') {
        linkStore.set(frontmatter);
        if (this.options.store == 'arango') {
          await this.arango.set(frontmatter);
        }
      } else {
        const file = this.makeFilename(frontmatter);
        this.output.write(file, { content: text, data: frontmatter });
        if (this.options.store == 'arango') {
          await this.arango.set({ ...frontmatter, text });
        }

        this.log.debug(`Wrote ${file}`);

        const nodeComments = comments.filter(c => c.about === frontmatter.id);
        if (nodeComments.length) {
          commentStore.set(frontmatter.id, nodeComments);
          this.log.debug(
            `Saved ${nodeComments.length} comments for ${frontmatter.id}`,
          );
          if (this.options.store === 'arango') {
            for (const c of nodeComments) {
              await this.arango.set(c);
            }
          }
        }
      }
    }

    const site = CreativeWorkSchema.parse({
      type: 'Blog',
      id: this.name,
      url: 'https://growingupgoddy.com',
      name: cache.vars['site_name'] || this.label,
      subtitle: cache.vars['site_slogan'] || undefined,
      software: 'Drupal 6',
      hosting: 'Linode',
    });
    this.data.bucket('things').set(site);
    if (this.options.store == 'arango') {
      await this.arango.set(site);
    }

    this.copyAssets('files', 'goddy');
    return Promise.resolve();
  }

  protected readTableCsv<T extends ZodTypeAny>(file: string, schema: T) {
    const raw = (this.input.read('tables/' + file, 'auto') as unknown[]) ?? [];
    return raw.map(u => schema.parse(u) as z.infer<T>);
  }

  protected prepEntry(input: drupal.GoddyNode): CreativeWork | Bookmark {
    if (input.link?.field_link_url) {
      return BookmarkSchema.parse({
        ...prepUrlForBookmark(input.link?.field_link_url),
        title: input.title,
        description: toMarkdown(autop(input.summary ?? '')) || undefined,
        date: input.created,
      });
    } else {
      return CreativeWorkSchema.parse({
        type: 'BlogPosting',
        id: `goddy-${input.nid}`,
        date: input.created,
        name: input.title,
        slug: toSlug(input.title),
        description: input.summary,
        isPartOf: this.name,
        quote: input.money_quote
          ? toMarkdown(autop(input.money_quote.field_money_quote_value))
          : undefined,
        isAbout:
          (input.product
            ? input.product.field_product_asin?.trim()
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
      id: `goddy-c${input.cid}`,
      about: `goddy-${input.nid}`,
      parent: input.pid ? `goddy-c${input.pid}` : undefined,
      sort: input.thread,
      date: input.created,
      commenter: {
        name: input.name,
        mail: input.mail,
        url: input.homepage,
      },
      name: input.subject,
      text: toMarkdown(autop(input.body ?? '')),
    });
  }
}
