import { autop, toMarkdown } from '@eatonfyi/html';
import { nanohash } from '@eatonfyi/ids';
import { Frontmatter } from '@eatonfyi/serializers';
import { toSlug } from '@eatonfyi/text';
import { Disqus } from '../../parsers/index.js';
import * as CommentOutput from '../../schemas/comment.js';
import { type MarkdownPost } from '../../schemas/markdown-post.js';
import { BlogMigrator, BlogMigratorOptions } from '../blog-migrator.js';
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

  protected override prepMarkdownFile(input: JekyllPost) {
    const md: MarkdownPost = { data: {} };

    md.data.date = input.data.date;
    md.data.title = input.data.title;
    md.data.slug = input.data.slug;
    md.data.summary = input.data.summary;
    md.data.published = input.data.published;

    if (input?.file) {
      const [, date, slug] =
        /(\d{4}-\d{2}-\d{2})-(.+)\.md/.exec(input.file) ?? [];
      md.data.date ??= date ? new Date(date.replaceAll('-', '/')) : undefined;
      md.data.slug ??= slug;
    }

    // If a slug doesn't exist, construct one by slugifying the title.
    md.data.slug ??= toSlug(md.data.title);

    md.data.url = `http://angrylittletree.com/${md.data.date?.getFullYear()}/${md.data.date?.getUTCMonth()}/${input.data.slug}.html`;
    md.data.id = nanohash(md.data.commentUrl);
    md.data.source = 'alt-jekyll';

    // If a filename doesn't already exist, construct one from the date and the slug.
    md.data.originalFile = input.file ?? this.toFilename(md.data.date, md.data.title) + '.md';
    md.content = input.content;

    return md;
  }

  override async finalize() {
    const data = await this.readCache();
    const commentStore = this.data.bucket('comments');

    for (const e of data.entries) {
      const md = this.prepMarkdownFile(e);

      const fileName = this.toFilename(md.data.date, md.data.slug ?? md.data.title);
      this.output.write(fileName, data);
      this.log.debug(`Wrote ${fileName}`);

      // Find a thread that matches this file.
      const comments =
        data.comments.find(t => t.id === md.data.id)?.posts ?? [];
      const mapped = comments.map(c => {
        const comment: CommentOutput.Comment = {
          id: `altj-c${c.dsqId}`,
          parent: c.parent ? `altj-c${c.parent}` : undefined,
          sort: c.sort,
          about: md.data.id!,
          date: c.createdAt,
          author: { name: c.author.name },
          body: toMarkdown(autop(c.message)),
        };
        return comment;
      });
      if (mapped.length) {
        commentStore.set(md.data.id!, mapped);
        this.log.debug(
          `Saved ${mapped.length} comments for ${md.data.id}`,
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
