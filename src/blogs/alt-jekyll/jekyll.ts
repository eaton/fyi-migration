import { BlogMigrator, BlogMigratorOptions } from "../blog-migrator.js";
import { Frontmatter } from "@eatonfyi/serializers";
import { jekyllPostSchema, type JekyllPost } from "./schema.js";
import { type MarkdownPost } from "../../schemas/markdown-post.js";
import { toSlug } from "@eatonfyi/text";
import { nanohash } from "@eatonfyi/ids";

const defaults: BlogMigratorOptions = {
  name: 'alt-jekyll',
  label: 'AngryLittleTree (Jekyll)',
  description: 'Posts, comments, and images from the Jekyll version of angrylittletree.com',
  input: 'input/blogs/angrylittletree-jekyll',
  cache: 'cache/blogs/angrylittletree-jekyll',
  output: 'src/entries/alt-jekyll',
}

export class AltJekyllMigrator extends BlogMigrator<MarkdownPost> {
  constructor(options: BlogMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled(): Promise<boolean> {
    return true;
  }

  override async readCache(): Promise<JekyllPost[]> {
    const entries: JekyllPost[] = [];
    const files = this.input.find({ matching: '*.md' });
    for (const file of files) {
      this.log.debug(`Parsing ${file}`);
      await this.input.readAsync(file, 'auto')
        .then((data: Frontmatter) => jekyllPostSchema.safeParse({ file, ...data }))
        .then(result => {
          if (result.success) {
            entries.push(result.data)
          } else {
            this.log.error(result.error.message);
          }
        });
    }

    return Promise.resolve(entries);
  }

  override async process() {
    this.queue = [];
    const data = await this.readCache();

    for (const e of data) {
      this.queue.push(this.prepMarkdownFile(e));
    }
    return Promise.resolve();
  }

  protected override prepMarkdownFile(input: JekyllPost) {
    const md: MarkdownPost = { data: {} };

    md.data.title = input.data.title;
    md.data.date = input.data.date;
    md.data.summary = input.data.summary;
    md.data.excerpt = input.data.excerpt;
    md.data.layout = input.data.layout;
    md.data.published = input.data.published;

    if (input?.file) {
      const [, date, slug] = /(\d{4}-\d{2}-\d{2})-(.+)\.md/.exec(input.file) ?? [];
      md.data.date ??= date ? new Date(date.replaceAll('-', '/')) : undefined
      md.data.slug ??= slug;
    }
  
    // If a slug doesn't exist, construct one by slugifying the title.
    md.data.slug ??= toSlug(md.data.title)

    md.data.commentUrl = `http://angrylittletree.com/${md.data.date?.getFullYear()}/${md.data.date?.getUTCMonth()}/${md.data.slug}.html`;
    md.data.commentGuid = nanohash(md.data.commentUrl);

    // If a filename doesn't already exist, construct one from the date and the slug.
    md.file = input.file ?? [this.dateToDate(md.data.date), md.data.slug].join('-') + '.md'
    md.content = input.content;
    
    md.data.migration = { site: 'alt-jekyll' };
    
    return md;
  }

  override async finalize() {
    for (const e of this.queue) {
      const { file, ...contents } = e;
      if (file) {
        const outFile = file.replace('_posts/', '')
        this.log.debug(`Outputting ${outFile}`);
        this.output.write(outFile, contents);
      } else {
        this.log.error(e);
      }
    }

    this.data.bucket('sites').set('alt-jekyll', {
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