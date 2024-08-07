import { autop, toMarkdown } from '@eatonfyi/html';
import {
  Comment,
  CommentSchema,
  CreativeWorkSchema,
  SocialMediaPosting,
  SocialMediaPostingSchema,
  Thing,
  toId,
} from '@eatonfyi/schema';
import { z } from 'zod';
import { sortByParents } from '../../util/parent-sort.js';
import { BlogMigrator, BlogMigratorOptions } from '../blog-migrator.js';
import * as drupal from './schema.js';

const defaults: BlogMigratorOptions = {
  name: 'alt-drupal',
  label: 'AngryLittleTree (Drupal)',
  description: 'Posts from the short-lived Drupal version of Angry Little Tree',
  input: 'input/blogs/angrylittletree-drupal',
  cache: 'cache/blogs/alt-drupal',
  output: 'src/entries/alt',
};

type drupalEntityData = {
  nodes: Record<number, drupal.AltNode>;
  comments: Record<number, drupal.AltComment>;
  variables: Record<string, unknown>;
  files: z.infer<typeof drupal.fileSchema>[];
  aliases: z.infer<typeof drupal.aliasSchema>[];
};

export class AltDrupalMigrator extends BlogMigrator {
  constructor(options: BlogMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  entries: SocialMediaPosting[] = [];
  comments: Comment[] = [];
  site?: Thing;

  entityData: drupalEntityData = {
    nodes: {},
    comments: {},
    variables: {},
    files: [],
    aliases: [],
  };

  override async cacheIsFilled(): Promise<boolean> {
    return Promise.resolve(this.cache.exists('variables.json') === 'file');
  }

  override async fillCache(): Promise<unknown> {
    const map = {
      nodes: { file: 'node.csv', schema: drupal.nodeSchema },
      nodeBodies: { file: 'field_data_body.csv', schema: drupal.bodySchema },
      comments: { file: 'comment.csv', schema: drupal.commentSchema },
      commentBodies: {
        file: 'field_data_comment_body.csv',
        schema: drupal.commentBodySchema,
      },
      attachments: {
        file: 'field_data_field_attachments.csv',
        schema: drupal.attachmentSchema,
      },
      files: { file: 'file_managed.csv', schema: drupal.fileSchema },
      variables: { file: 'variable.csv', schema: drupal.variableSchema },
    };

    const parsed: Record<string, Record<string, unknown>[]> = {};

    for (const [key, opt] of Object.entries(map)) {
      this.log.debug(`Parsing ${opt.file}`);
      const raw =
        (this.input.dir('tables').read(opt.file, 'auto') as Record<
          string,
          unknown
        >[]) ?? [];
      parsed[key] = raw.map(r => opt.schema.parse(r));
      this.cache.write(
        key + '.json',
        parsed[key].filter(v => v.status !== 0),
        { jsonIndent: 2 },
      );
    }

    return Promise.resolve();
  }

  override async readCache(): Promise<drupalEntityData> {
    const nodes = this.cache.read(
      'nodes.json',
      'jsonWithDates',
    ) as drupal.AltNode[];
    const nodeBodies = this.cache.read(
      'nodeBodies.json',
      'jsonWithDates',
    ) as z.infer<typeof drupal.bodySchema>[];
    const attachments = this.cache.read(
      'attachments.json',
      'jsonWithDates',
    ) as z.infer<typeof drupal.attachmentSchema>[];
    this.entityData.files = this.cache.read(
      'files.json',
      'jsonWithDates',
    ) as z.infer<typeof drupal.fileSchema>[];
    const comments = this.cache.read(
      'comments.json',
      'jsonWithDates',
    ) as z.infer<typeof drupal.commentSchema>[];
    const commentBodies = this.cache.read(
      'commentBodies.json',
      'jsonWithDates',
    ) as z.infer<typeof drupal.commentBodySchema>[];
    this.entityData.aliases = this.cache.read(
      'aliases.json',
      'jsonWithDates',
    ) as z.infer<typeof drupal.aliasSchema>[];
    const variables = this.cache.read(
      'variables.json',
      'jsonWithDates',
    ) as z.infer<typeof drupal.variableSchema>[];

    this.log.debug(`Processing nodes`);
    for (const n of nodes) {
      const body = nodeBodies.find(
        b =>
          b.entity_type === 'node' &&
          b.entity_id === n.nid &&
          b.revision_id === n.vid,
      );
      n.body = body?.body_value;
      n.summary = body?.body_summary;

      const atts = attachments.filter(
        a =>
          a.entity_type === 'node' &&
          a.entity_id === n.nid &&
          a.revision_id === n.vid,
      );
      for (const a of atts) {
        a.file = this.entityData.files.find(
          f => f.fid === a.field_attachments_fid,
        );
      }
      n.attachments = atts;

      this.entityData.nodes[n.nid] = n;
    }
    this.log.debug(`Processing comments`);
    for (const c of comments) {
      const body = commentBodies.find(
        cb => cb.entity_type === 'comment' && cb.entity_id === c.cid,
      );
      c.body = body?.comment_body_value;

      this.entityData.comments[c.cid] = c;
    }

    for (const v of variables) {
      this.entityData.variables[v.name] = v.value;
    }

    return this.entityData;
  }

  override async process() {
    await this.readCache();

    for (const n of Object.values(this.entityData.nodes)) {
      const md = this.prepEntry(n);
      this.entries.push(md);
    }

    for (const c of Object.values(this.entityData.comments)) {
      this.comments.push(this.prepComment(c));
    }
  }

  override async finalize() {
    // Currently ignoring comments, whoop whoop
    for (const e of this.entries) {
      const entryComments = this.comments.filter(c => c.about === e.id);
      if (entryComments.length) {
        e.commentCount = entryComments.length;
        sortByParents(entryComments);
        await this.saveThings(entryComments);
      }
      await this.saveThing(e);
    }

    await this.saveThing(
      CreativeWorkSchema.parse({
        id: toId('blog', 'alt'),
        type: 'Blog',
        url: 'https://angrylittletree.com',
        name: this.entityData.variables['site_name']?.toString() ?? undefined,
        subtitle:
          this.entityData.variables['site_slogan']?.toString() ?? undefined,
      }),
    );

    await this.copyAssets('files', 'alt');
  }

  protected prepEntry(input: drupal.AltNode) {
    return SocialMediaPostingSchema.parse({
      type: 'BlogPosting',
      id: toId('post', `alt${input.nid}`),
      date: input.created,
      name: input.title,
      description: input.summary ? toMarkdown(input.summary) : undefined,
      text: input.body ? toMarkdown(autop(input.body)) : '',
      isPartOf: toId('blog', 'alt'),
      attachments: input.attachments?.map(a => ({
        filename: a.file?.filename,
        description: a.field_attachments_description,
      })),
    });
  }

  protected prepComment(input: drupal.AltComment): Comment {
    return CommentSchema.parse({
      id: toId('comment', `alt${input.cid}d`),
      parent: input.pid ? toId('comment', `alt${input.pid}d`) : undefined,
      about: toId('post', `alt${input.nid}`),
      date: input.created,
      commenter: {
        name: input.name,
        mail: input.mail,
        url: input.homepage,
      },
      thread: undefined, // We throw away the thread value and recalculate it later.
      isPartOf: toId('blog', 'alt'),
      name: input.subject,
      text: toMarkdown(autop(input.body ?? '')),
    });
  }
}
