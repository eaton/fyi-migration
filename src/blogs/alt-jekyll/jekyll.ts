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
import { sortByParents } from '../../util/parent-sort.js';

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
    const commentStore = this.data.bucket('comments');

    for (const e of this.entries) {
      const { text, ...frontmatter } = e;
      const fileName = this.makeFilename(frontmatter);
      this.output.write(fileName, { data: frontmatter, content: text });
      if (this.options.store == 'arango') {
        await this.arango.set({ ...frontmatter, text });
      }

      this.log.debug(`Wrote ${fileName}`);

      // Find a thread that matches this file.
      const comments = this.comments[e.id];
      if (comments?.length) {
        commentStore.set(frontmatter.id, comments);
        this.log.debug(
          `Saved ${comments.length} comments for ${frontmatter.url}`,
        );
        if (this.options.store === 'arango') {
          for (const c of this.comments[e.id]) {
            await this.arango.set(c);
          }
        }
      }
    }

    this.data.bucket('things').set(
      'alt-jekyll',
      CreativeWorkSchema.parse({
        type: 'Blog',
        id: 'alt-jekyll',
        url: 'https://angrylittletree.com',
        name: 'Angry Little Tree',
        hosting: 'Github Pages',
        software: 'Jekyll',
      }),
    );

    await this.copyAssets('files', 'alt');
    return Promise.resolve();
  }

  protected prepEntry(input: JekyllPost): CreativeWork {
    const cw: CreativeWorkInput = {
      type: 'BlogPosting',
      id: 'tmp',
      date: input.data.date,
      name: input.data.title,
      description: input.data.title,
      headline: input.data.subtitle
        ? input.data.title + ': ' + input.data.subtitle
        : undefined,
      slug: input.data.slug,
    };

    if (input?.file) {
      const [, date, slug] =
        /(\d{4}-\d{2}-\d{2})-(.+)\.md/.exec(input.file) ?? [];
      cw.date ??= date ? new Date(date.replaceAll('-', '/')) : undefined;
      cw.slug ??= slug;
    }

    cw.url = `http://angrylittletree.com/${input.data.date?.getFullYear()}/${input.data.date?.getUTCMonth()}/${input.data.slug}.html`;
    cw.id = 'alt-' + nanohash(cw.url);
    cw.isPartOf = 'alt-jekyll';

    cw.text = input.content;

    return CreativeWorkSchema.parse(cw);
  }

  protected prepComment(comment: Disqus.Post): Comment {
    return CommentSchema.parse({
      id: `altj-c${comment.dsqId}`,
      parent: comment.parent ? `altj-c${comment.parent}` : undefined,
      about: comment.linkId ? `altj-c${comment.linkId}` : undefined,
      date: comment.createdAt,
      commenter: { name: comment.author.name },
      text: toMarkdown(autop(comment.message)),
    });
  }
}
