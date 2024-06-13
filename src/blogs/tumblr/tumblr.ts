import { toMarkdown } from '@eatonfyi/html';
import { toSlug } from '@eatonfyi/text';
import { Client } from '@serguun42/tumblr.js';
import {
  CreativeWorkInput,
  CreativeWorkSchema,
} from '../../schemas/creative-work.js';
import { prepUrlForBookmark } from '../../util/clean-link.js';
import { BlogMigrator, BlogMigratorOptions } from '../blog-migrator.js';
import {
  BlogSchema,
  TumblrUser,
  UserInfoSchema,
  type TumblrBlog,
  type TumblrPost,
} from './schema.js';
import { BookmarkSchema } from '../../schemas/bookmark.js';

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

export class TumblrMigrator extends BlogMigrator {
  declare options: TumblrMigratorOptions;

  blogs: TumblrBlog[] = []; // Records for individual Tumblr blogs
  posts: TumblrPost[] = []; // Records for individual posts
  links: TumblrPost[] = []; // Records for link, photo, and video posts
  user?: TumblrUser; // Records for individual Tumblr blogs

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

  override async readCache() {
    this.user = this.cache.read('user-info.json', 'auto') as TumblrUser;
    this.blogs = this.cache
      .find({ matching: '*/blog-info.json' })
      .map(b => this.cache.read(b, 'auto') as TumblrBlog);
    const posts = this.cache
      .find({ matching: '*/post-*.json' })
      .map(p => this.cache.read(p, 'auto') as TumblrPost);

    const isLink = (p: TumblrPost) => p.type === 'link';
    this.posts = posts.filter(p => !isLink(p));
    this.links = posts.filter(p => isLink(p));

    return { posts: this.posts, links: this.links, user: this.user };
  }

  override async finalize() {
    const linkStore = this.data.bucket('links');
    const thingStore = this.data.bucket('things');

    for (const e of this.posts) {
      const md = this.prepEntry(e);
      const file = this.makeFilename(md);
      const { text, ...frontmatter } = md;
      this.output.write(file, { content: text, data: frontmatter });
      this.log.debug(`Wrote ${file}`);
    }

    if (this.links && this.links.length) {
      for (const l of this.links.map(l => this.prepLink(l))) {
        linkStore.set(l.id, l);
      }
    }

    if (this.blogs && this.blogs.length) {
      for (const b of this.blogs.map(b => this.prepSite(b))) {
        thingStore.set(b.id, b);
      }
    }

    await this.copyAssets('blogs/tumblr/files', 'tumblr');
    return Promise.resolve();
  }

  protected prepSite(input: TumblrBlog) {
    return CreativeWorkSchema.parse({
      type: 'Blog',
      id: input.name,
      name: input.title || undefined,
      description: input.description || undefined,
      url: input.url,
      hosting: 'Tumblr',
    });
  }

  protected prepEntry(input: TumblrPost) {
    const cw: CreativeWorkInput = {
      type: 'BlogPosting',
      id: `entry/tumblr-${input.id}`,
      name: input.title ?? undefined,
      slug: input.slug || toSlug(input.title ?? input.id?.toString() ?? ''),
      description: input.summary || undefined,
      excerpt: input.excerpt || undefined,
      date: input.date ? new Date(input.date) : undefined,
      published: !!input.date,
      keywords: input.tags,
      url: input.url,
      isPartOf: `${input.blog_name}`,
      tumblrType: input.type,
    };

    if (input.type === 'photo') {
      cw.image =
        input.photos?.pop()?.original_size?.url?.toString() ?? undefined;
      cw.text ||= input.caption ? toMarkdown(input.caption) : '';
    } else if (input.type === 'video') {
      cw.text ||=
        input.permalink_url +
        (input.caption ? '\n\n' + toMarkdown(input.caption) : '');
    } else {
      cw.text = input.body ? toMarkdown(input.body) : '';
    }

    if (input.publisher) {
      // TODO: 'via X' links
    }

    return CreativeWorkSchema.parse(cw);
  }

  protected prepLink(input: TumblrPost) {
    const link = BookmarkSchema.parse({
      ...prepUrlForBookmark(input.url, input.blog_name),
      date: input.date || undefined,
      name: input.title || input.source_title || undefined,
      description:
        input.body || input.description || input.summary || undefined,
      isPartOf: input.blog_name,
    });

    // Lotta wacky stuff happening, friends.
    if (link.description) link.description = toMarkdown(link.description);
    return link;
  }
}
