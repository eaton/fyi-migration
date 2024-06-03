import { autop, toMarkdown } from '@eatonfyi/html';
import { nanohash } from '@eatonfyi/ids';
import { Frontmatter } from '@eatonfyi/serializers';
import { Comment, CommentSchema } from '../../schemas/comment.js';
import {
  CreativeWork,
  CreativeWorkInput,
  CreativeWorkSchema,
} from '../../schemas/creative-work.js';
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
  output: 'src/entries/alt-jekyll',
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
        const identifier = thread.id;
        this.comments[identifier] ??= [];
        for (const comment of thread.posts) {
          this.comments[identifier].push(this.prepComment(comment));
        }
      }
    }

    return Promise.resolve({ entries: this.entries, comments: this.comments });
  }

  override async finalize() {
    const data = await this.readCache();
    const commentStore = this.data.bucket('comments');

    for (const e of data.entries) {
      const { text, ...frontmatter } = e;
      const fileName = this.toFilename(frontmatter);
      this.output.write(fileName, { data: frontmatter, content: text });
      this.log.debug(`Wrote ${fileName}`);

      // Find a thread that matches this file.
      const comments = this.comments[e.id];
      if (comments.length) {
        commentStore.set(frontmatter.id, comments);
        this.log.debug(
          `Saved ${comments.length} comments for ${frontmatter.url}`,
        );
      }
    }

    this.data.bucket('sources').set('alt-jekyll', {
      id: 'alt-jekyll',
      url: 'https://angrylittletree.com',
      title: 'Angry Little Tree',
      hosting: 'Github Pages',
      software: 'Jekyll',
    });

    await this.copyAssets('files', 'alt');
    return Promise.resolve();
  }

  protected prepEntry(input: JekyllPost): CreativeWork {
    const md: CreativeWorkInput = {
      id: 'tmp',
      date: input.data.date,
      title: input.data.title,
      slug: input.data.slug,
      description: input.data.summary,
    };

    if (input?.file) {
      const [, date, slug] =
        /(\d{4}-\d{2}-\d{2})-(.+)\.md/.exec(input.file) ?? [];
      md.date ??= date ? new Date(date.replaceAll('-', '/')) : undefined;
      md.slug ??= slug;
    }
    md.url = `http://angrylittletree.com/${input.data.date?.getFullYear()}/${input.data.date?.getUTCMonth()}/${input.data.slug}.html`;
    md.id = 'alt-' + nanohash(md.url);
    md.isPartOf = 'alt-jekyll';

    md.content = input.content;

    return CreativeWorkSchema.parse(md);
  }

  protected prepComment(comment: Disqus.Post): Comment {
    return CommentSchema.parse({
      id: `altj-c${comment.dsqId}`,
      parent: comment.parent ? `altj-c${comment.parent}` : undefined,
      about: comment.linkId ? `altj-c${comment.linkId}` : undefined,
      sort: comment.sort,
      date: comment.createdAt,
      commenter: { name: comment.author.name },
      text: toMarkdown(autop(comment.message)),
    });
  }
}
