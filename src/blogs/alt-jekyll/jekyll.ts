import { BlogMigrator, BlogMigratorOptions } from "../blog-migrator.js";
import { Frontmatter } from "@eatonfyi/serializers";
import { jekyllPostSchema, type JekyllPost } from "./schema.js";

const defaults: BlogMigratorOptions = {
  name: 'alt-jekyll',
  label: 'AngryLittleTree (Jekyll)',
  description: 'Posts, comments, and images from the Jekyll version of angrylittletree.com',
  input: 'input/blogs/angrylittletree-jekyll',
  cache: 'cache/blogs/angrylittletree-jekyll',
  output: 'src/entries/alt-jekyll',
  assetInput: 'input/blogs/angrylittletree-jekyll/files',
  assetOutput: 'src/_static/alt',
}

export class JekyllImport extends BlogMigrator<JekyllPost> {
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
      if (e?.file) {
        const [, date, slug] = /(\d{4}-\d{2}-\d{2})-(.+)\.md/.exec(e.file) ?? [];
        e.data.date ??= date ? new Date(date.replaceAll('-', '/')) : undefined
        e.data.slug ??= slug;
      }
      this.queue.push(e);
    }
  }

  override async finalize() {
    for (const e of this.queue) {
      const { file, ...contents } = e;
      if (file) {
        this.output.write(file, contents);
      } else {
        this.log.error(e);
      }
    }

    await this.copyAssets();
  }
}