import { autop, toMarkdown } from '@eatonfyi/html';
import { nanohash } from '@eatonfyi/ids';
import { Frontmatter } from '@eatonfyi/serializers';
import {
  Comment,
  CommentSchema,
} from '../../schemas/schema-org/CreativeWork/comment.js';
import { SocialMediaPostingSchema } from '../../schemas/schema-org/CreativeWork/social-media-post.js';
import {
  CreativeWork,
  CreativeWorkSchema,
} from '../../schemas/schema-org/creative-work.js';
import { toId } from '../../shared/schemer.js';
import { sortByParents } from '../../util/parent-sort.js';
import { BlogMigrator, BlogMigratorOptions } from '../blog-migrator.js';
import * as Disqus from '../disqus-export.js';
import { jekyllPostSchema, type JekyllPost } from './schema.js';

const defaults: BlogMigratorOptions = {
  name: 'alt-jekyll',
  label: 'AngryLittleTree (Jekyll)',
  description:
    'Posts, comments, and images from the Jekyll version of angrylittletree.com',
  input: 'input/blogs/angrylittletree-jekyll',
  cache: 'cache/blogs/angrylittletree-jekyll',
  output: 'src/entries/alt',
};

export class AltJekyllMigrator extends BlogMigrator {
  entries: CreativeWork[] = [];
  comments: Record<string, Comment[]> = {};

  constructor(options: BlogMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled(): Promise<boolean> {
    return true;
  }

  override async readCache() {
    const files = this.input.find({ matching: '*.md' });
    for (const file of files) {
      this.log.debug(`Parsing ${file}`);
      await this.input
        .readAsync(file, 'auto')
        .then((data: Frontmatter) =>
          jekyllPostSchema.safeParse({ file, ...data }),
        )
        .then(result => {
          if (result.success) {
            const cw = this.prepEntry(result.data);
            this.entries.push(cw);
          } else {
            this.log.error(result.error.message);
          }
        });
    }

    for (const file of this.input.find({ matching: 'disqus*.xml' })) {
      const xml = this.input.read(file, 'utf8') ?? '';
      const threads = (await Disqus.parse(xml)).threads;
      for (const thread of threads) {
        const identifier = nanohash(thread.id);
        this.comments[identifier] ??= [];
        for (const comment of thread.posts) {
          this.comments[identifier].push(this.prepComment(comment));
        }

        // Add threading. Why not.
        sortByParents(this.comments[identifier]);
      }
    }

    return { entries: this.entries, comments: this.comments };
  }

  override async finalize() {
    if (this.entries.length === 0) {
      await this.readCache();
    }

    for (const e of this.entries) {
      const comments = this.comments[e.id];
      if (comments?.length) {
        e.commentCount = comments.length;
        await this.saveThings(comments);
      }
      await this.saveThings(e);
    }

    await this.saveThing(
      CreativeWorkSchema.parse({
        type: 'Blog',
        id: toId('blog', 'alt'),
        url: 'https://angrylittletree.com',
        name: 'Angry Little Tree',
      }),
    );

    await this.copyAssets('files', 'alt');
    return Promise.resolve();
  }

  protected prepEntry(input: JekyllPost): CreativeWork {
    const cw = SocialMediaPostingSchema.parse({
      type: 'BlogPosting',
      id: 'tmp.tmp',
      date: input.data.date,
      name: input.data.title,
      description: input.data.summary,
      isPartOf: toId('blog', 'alt'),
      headline: input.data.subtitle
        ? input.data.title + ': ' + input.data.subtitle
        : undefined,
      slug: input.data.slug,
      text: input.content,
    });

    if (input?.file) {
      const [, date, slug] =
        /(\d{4}-\d{2}-\d{2})-(.+)\.md/.exec(input.file) ?? [];
      cw.date ??= date ? new Date(date.replaceAll('-', '/')) : undefined;
      cw.slug ??= slug;
    }

    const oldUrl = `/${cw.date?.getFullYear()}/${cw.date?.getUTCMonth()}/${cw.slug}.html`;
    cw.id = toId('post', 'alt-' + nanohash(oldUrl));
    cw.isPartOf = toId('blog', 'alt');

    return CreativeWorkSchema.parse(cw);
  }

  protected prepComment(comment: Disqus.Post): Comment {
    return CommentSchema.parse({
      id: toId('comment', `alt-c${comment.dsqId}`),
      parent: comment.parent
        ? toId('comment', `alt-c${comment.parent}`)
        : undefined,
      about: comment.linkId
        ? toId('post', `alt-${nanohash(comment.linkId)}`)
        : undefined,
      date: comment.createdAt,
      isPartOf: toId('blog', 'alt'),
      commenter: { name: comment.author.name },
      text: toMarkdown(autop(comment.message)),
    });
  }
}
