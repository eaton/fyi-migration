import { autop, toMarkdown } from '@eatonfyi/html';
import { nanohash } from '@eatonfyi/ids';
import { Frontmatter } from '@eatonfyi/serializers';
import { CommentInput, CommentSchema } from '../../schemas/comment.js';
import {
  CreativeWorkInput,
  CreativeWorkSchema,
} from '../../schemas/creative-work.js';
import { type MarkdownPost } from '../../schemas/markdown-post.js';
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

export class AltJekyllMigrator extends BlogMigrator<MarkdownPost> {
  constructor(options: BlogMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled(): Promise<boolean> {
    return true;
  }

  override async readCache() {
    const entries: JekyllPost[] = [];
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
            entries.push(result.data);
          } else {
            this.log.error(result.error.message);
          }
        });
    }

    const comments: Disqus.Thread[] = [];
    for (const file of this.input.find({ matching: 'disqus*.xml' })) {
      const xml = this.input.read(file, 'utf8') ?? '';
      comments.push(...(await Disqus.parse(xml)).threads);
    }

    return Promise.resolve({ entries, comments });
  }

  protected prepEntry(input: JekyllPost) {
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
    md.id = nanohash(md.url);
    md.isPartOf = 'alt-jekyll';

    md.content = input.content;

    return CreativeWorkSchema.parse(md);
  }

  override async finalize() {
    const data = await this.readCache();
    const commentStore = this.data.bucket('comments');

    for (const e of data.entries) {
      const { content, ...frontmatter } = this.prepEntry(e);
      const fileName = this.toFilename(frontmatter);
      this.output.write(fileName, { data: frontmatter, content });
      this.log.debug(`Wrote ${fileName}`);

      // Find a thread that matches this file.
      const comments =
        data.comments.find(t => t.id === frontmatter.id)?.posts ?? [];
      const mapped = comments.map(c => {
        const comment: CommentInput = {
          id: `altj-c${c.dsqId}`,
          parent: c.parent ? `altj-c${c.parent}` : undefined,
          sort: c.sort,
          date: c.createdAt,
          commenter: { name: c.author.name },
          text: toMarkdown(autop(c.message)),
        };
        return CommentSchema.parse(comment);
      });
      if (mapped.length) {
        commentStore.set(frontmatter.id, mapped);
        this.log.debug(
          `Saved ${mapped.length} comments for ${frontmatter.url}`,
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
}
