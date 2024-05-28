import { BlogMigrator, BlogMigratorOptions } from "../blog-migrator.js";
import * as schemas from "./schema.js";
import { type MarkdownPost } from "../../schemas/markdown-post.js";
import { z } from 'zod';
import { toMarkdown } from "@eatonfyi/html";
import { toSlug } from "@eatonfyi/text";

const defaults: BlogMigratorOptions = {
  name: 'alt-drupal',
  label: 'AngryLittleTree (Drupal)',
  description: 'Posts from the short-lived Drupal version of Angry Little Tree',
  input: 'input/blogs/angrylittletree-drupal/tables',
  assetInput: 'input/blogs/angrylittletree-drupal/files',
  cache: 'cache/blogs/alt-drupal',
  output: 'src/entries/alt',
  assetOutput: 'src/_static/alt'
}

type drupalEntityData = {
  nodes: Record<number, z.infer<typeof schemas.nodeSchema>>,
  comments: Record<number, z.infer<typeof schemas.commentSchema>>,
  variables: Record<string, unknown>,
  files: z.infer<typeof schemas.fileSchema>[],
  aliases: z.infer<typeof schemas.aliasSchema>[],
};

export class AltDrupalMigrator extends BlogMigrator<MarkdownPost> {
  constructor(options: BlogMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  entries: MarkdownPost[] = [];
  comments: MarkdownPost[] = [];
  site?: MarkdownPost;


  data: drupalEntityData = {
    nodes: {},
    comments: {},
    variables: {},
    files: [],
    aliases: [],
  }

  override async cacheIsFilled(): Promise<boolean> {
    return Promise.resolve(this.cache.exists('variables.json') === 'file');
  }

  override async fillCache(): Promise<unknown> {
    const map = {
      nodes: { file: 'node.csv', schema: schemas.nodeSchema },
      nodeBodies: { file: 'field_data_body.csv', schema: schemas.bodySchema },
      comments: { file: 'comment.csv', schema: schemas.commentSchema },
      commentBodies: { file: 'field_data_comment_body.csv', schema: schemas.commentBodySchema },
      attachments: { file: 'field_data_field_attachments.csv', schema: schemas.attachmentSchema },
      files: { file: 'file_managed.csv', schema: schemas.fileSchema },
      variables: { file: 'variable.csv', schema: schemas.variableSchema },
    };

    const parsed: Record<string, Record<string, unknown>[]> = {};

    for (const [key, opt] of Object.entries(map)) {
      const raw = this.input.read(opt.file, 'auto') as Record<string, unknown>[];
      parsed[key] = raw.map(r => opt.schema.parse(r));
      this.cache.write(key + '.json', parsed[key].filter(v => v.status !== 0), { jsonIndent: 2 });
    }

    return Promise.resolve();
  }

  override async readCache(): Promise<drupalEntityData> {
    const nodes = this.cache.read('nodes.json', 'auto') as z.infer<typeof schemas.nodeSchema>[];
    const nodeBodies = this.cache.read('nodeBodies.json', 'auto') as z.infer<typeof schemas.bodySchema>[];
    const attachments = this.cache.read('attachments.json', 'auto') as z.infer<typeof schemas.attachmentSchema>[];
    this.data.files = this.cache.read('files.json', 'auto') as z.infer<typeof schemas.fileSchema>[];
    const comments = this.cache.read('comments.json', 'auto') as z.infer<typeof schemas.commentSchema>[];
    const commentBodies = this.cache.read('commentBodies.json', 'auto') as z.infer<typeof schemas.commentBodySchema>[];
    this.data.aliases = this.cache.read('aliases.json', 'auto') as z.infer<typeof schemas.aliasSchema>[];
    const variables = this.cache.read('variables.json', 'auto') as z.infer<typeof schemas.variableSchema>[];

    for (const n of nodes) {
      const body = nodeBodies.find(b => b.entity_type === 'node' && b.entity_id === n.nid && b.revision_id === n.vid);
      n.body = body?.body_value;
      n.summary = body?.body_summary;

      const atts = attachments.filter(a => a.entity_type === 'node' && a.entity_id === n.nid && a.revision_id === n.vid);
      for (const a of atts) {
        a.file = this.data.files.find(f => f.fid === a.field_attachments_fid);
      }
      n.attachments = atts;

      this.data.nodes[n.nid] = n;
    }

    for (const c of comments) {
      const body = commentBodies.find(cb => cb.entity_type === 'comment' && cb.entity_id === c.cid);
      c.body = body?.comment_body_value;

      this.data.comments[c.cid] = c;
    }

    for (const v of variables) {
      this.data.variables[v.name] = v.value;
    }
    
    return Promise.resolve(this.data);
  }

  override async process() {
    await this.readCache();

    for (const n of Object.values(this.data.nodes)) {
      const md: MarkdownPost = {
        content: n.body ? toMarkdown(n.body) : '',
        data: {
          id: `entry/alt-${n.nid}`,
          title: n.title,
          date: n.created,
          summary: n.summary ? toMarkdown(n.summary) : undefined,
          slug: toSlug(n.title),
          migration: {
            site: 'site/alt-drupal',
            nid: n.nid,
            attachments: n.attachments?.map(a => ({ filename: a.file?.filename, description: a.field_attachments_description }))
          }
        },
      };

      this.entries.push(md);
    };

    for (const c of Object.values(this.data.comments)) {
      const md: MarkdownPost = {
        content: c.body ? toMarkdown(c.body) : '',
        data: {
          id: `comment/alt-${c.nid}-${c.cid}`,
          permalink: false,
          title: c.subject?.toString() ?? undefined,
          date: c.created,
          migration: {
            site: 'site/alt-drupal',
            parent: c.pid ? `comment/alt-${c.nid}-${c.pid}` : undefined,
            thread: c.thread,
            author: {
              name: c.name,
              url: c.homepage,
              email: c.mail,
              ip: c.hostname
            }
          }
        },
      };
      this.comments.push(md);
    }

    this.site = {
      file: 'alt-drupal.md',
      data: {
        id: 'site/alt-drupal',
        url: 'https://angrylittletree.com',
        title: this.data.variables['site_name']?.toString() ?? undefined,
        summary: this.data.variables['site-slogan']?.toString() ?? undefined,
      },
      content: '',
    }
  }

  override async finalize() {
    if (this.site && this.site.file) {
      this.root.dir('src/sites/').write(this.site.file, this.site);
    }

    // Currently ignoring comments, whoop whoop
    for (const entry of this.entries) {
      const filename = this.dateToDate(entry.data.date) + '-' + entry.data.slug + '.md';
      this.log.info(filename);
      this.output.write(filename, entry);
    }

    await this.copyAssets();
  }
}