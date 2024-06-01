import { toMarkdown } from '@eatonfyi/html';
import { nanohash } from '@eatonfyi/ids';
import { toSlug } from '@eatonfyi/text';
import { normalize } from '@eatonfyi/urls';
import { Client } from '@serguun42/tumblr.js';
import { type MarkdownPost } from '../../schemas/markdown-post.js';
import { BlogMigrator, BlogMigratorOptions } from '../blog-migrator.js';
import {
  BlogSchema,
  TumblrUser,
  UserInfoSchema,
  type TumblrBlog,
  type TumblrPost,
} from './schema.js';

export interface TumblrMigratorOptions extends BlogMigratorOptions {
  consumer_key?: string;
  consumer_secret?: string;
  token?: string;
  token_secret?: string;
  blogs?: string[];
}

const defaults: TumblrMigratorOptions = {
  name: 'tumblr',
  label: 'Tumblr',
  description: 'Posts from various Tumblr blogs',
  cache: 'cache/blogs/tumblr',
  output: 'src/entries/tumblr',

  consumer_key: process.env.TUMBLR_CONSUMER_KEY ?? undefined,
  consumer_secret: process.env.TUMBLR_CONSUMER_SECRET ?? undefined,
  token: process.env.TUMBLR_TOKEN ?? undefined,
  token_secret: process.env.TUMBLR_TOKEN_SECRET ?? undefined,

  blogs: ['cmswhoops', 'govertainment', 'plf', 'tomyformerself'],
};

export class TumblrMigrator extends BlogMigrator<TumblrPost> {
  declare options: TumblrMigratorOptions;

  blogs?: TumblrBlog[] = []; // Records for individual Tumblr blogs
  user?: TumblrUser; // Records for individual Tumblr blogs
  links?: TumblrPost[]; // Records for link, photo, and video posts

  constructor(options: TumblrMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled(): Promise<boolean> {
    return Promise.resolve(this.cache.exists('user-info.json') === 'file');
  }

  override async fillCache(): Promise<unknown> {
    if (
      !this.options.consumer_key ||
      !this.options.consumer_secret ||
      !this.options.token ||
      !this.options.token_secret
    ) {
      this.log.error('No Tumblr auth tokens were given.');
      return Promise.reject();
    }

    this.log.debug(`Hitting Tumblr API`);

    const t = new Client({
      consumer_key: this.options.consumer_key,
      consumer_secret: this.options.consumer_secret,
      token: this.options.token,
      token_secret: this.options.token_secret,
    });

    const userRaw = await t.userInfo();
    const { blogs, ...user } = UserInfoSchema.parse(userRaw).user;
    this.cache.write('user-info.json', user, { jsonIndent: 2 });

    for (const blog of blogs ?? []) {
      if (
        blog.admin &&
        blog.name &&
        (!this.options.blogs || this.options.blogs.includes(blog.name))
      ) {
        const blogDir = this.cache.dir(blog.name);
        blogDir.write('blog-info.json', blog, { jsonIndent: 2 });

        const rawPosts = await t.blogPosts(blog.name);
        const { posts } = BlogSchema.parse(rawPosts);

        if (typeof posts === 'number') continue;

        for (const post of posts ?? []) {
          blogDir.write(`post-${post.id}.json`, post);
        }
      }
    }

    return Promise.resolve();
  }

  override async readCache(): Promise<TumblrPost[]> {
    this.user = this.cache.read(
      'user-info.json',
      'jsonWithDates',
    ) as TumblrUser;
    this.blogs = this.cache
      .find({ matching: '*/blog-info.json' })
      .map(b => this.cache.read(b, 'auto') as TumblrBlog);
    const posts = this.cache
      .find({ matching: '*/post-*.json' })
      .map(p => this.cache.read(p, 'auto') as TumblrPost);

    const isLink = (p: TumblrPost) => p.type === 'link';

    this.queue = posts.filter(p => !isLink(p));
    this.links = posts.filter(p => isLink(p));

    return Promise.resolve(this.queue);
  }

  override async finalize() {
    for (const e of this.queue) {
      const md = this.prepMarkdownFile(e);
      const { file, ...post } = md;
      if (file) {
        this.log.debug(`Outputting ${file}`);
        this.output.write(file, post);
      } else {
        this.log.error(e);
      }
    }

    this.writeBlogInfo();
    this.writeLinks();
    await this.copyAssets('blogs/tumblr/files', 'tumblr');
    return Promise.resolve();
  }

  protected override prepMarkdownFile(input: TumblrPost): MarkdownPost {
    const md: MarkdownPost = {
      data: {
        id: `entry/tumblr-${input.id}`,
        title: input.title ?? undefined,
        slug: input.slug || toSlug(input.title ?? input.id?.toString() ?? ''),
        summary: input.summary,
        excerpt: input.excerpt ?? undefined,
        date: input.date ? new Date(input.date) : undefined,
        published: !!input.date,
        keywords: input.tags,
        url: input.url,
      },
    };

    md.data.migration = {
      site: `${input.blog_name}`,
      tumblrId: input.id,
      type: input.type,
    };

    md.file = `${this.dateToDate(md.data.date)}-${md.data.slug}.md`;

    if (input.type === 'photo') {
      md.data.image =
        input.photos?.pop()?.original_size?.url?.toString() ?? undefined;
      md.content ||= input.caption ? toMarkdown(input.caption) : '';
    } else if (input.type === 'video') {
      md.content ||=
        input.permalink_url +
        (input.caption ? '\n\n' + toMarkdown(input.caption) : '');
    } else {
      md.content = input.body ? toMarkdown(input.body) : '';
    }

    if (input.publisher) {
      // TODO: 'via X' links
    }

    return md;
  }

  protected writeBlogInfo() {
    if (this.blogs) {
      for (const blog of this.blogs) {
        this.data.bucket('sites').set(blog.name!, {
          id: blog.name,
          title: blog.title,
          summary: blog.description,
          url: blog.url,
          hosting: 'Tumblr',
        });
      }
    }
  }

  protected writeLinks() {
    const linkStore = this.data.bucket('links');
    for (const l of this.links ?? []) {
      if (l.url) {
        const link = {
          url: normalize(l.url),
          date: l.date || undefined,
          title: l.title || l.source_title || undefined,
          description: l.body || l.description || l.summary || undefined,
          source: l.blog_name,
        };

        // Lotta wacky stuff happening, friends.
        if (link.description) link.description = toMarkdown(link.description);

        linkStore.set(nanohash(link.url), link);
      }
    }
  }
}
