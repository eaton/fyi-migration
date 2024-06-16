import { nanohash } from '@eatonfyi/ids';
import { Frontmatter } from '@eatonfyi/serializers';
import { Article, ArticleSchema } from '../schemas/article.js';
import { Migrator, MigratorOptions } from '../shared/migrator.js';

const defaults: MigratorOptions = {
  name: 'articles',
  description: 'Article reprints',
  input: 'input/articles',
  output: 'src/articles',
};

export class ArticleReprintMigrator extends Migrator {
  articles: Article[] = [];

  constructor(options: MigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async readCache() {
    const parser = new Frontmatter();
    for (const f of this.input.find({ matching: 'reprints/**/*.md' })) {
      const raw = this.input.read(f, 'utf8');
      if (!raw) continue;
      const markdown = parser.parse(raw);
      const headline =
        markdown.data.headline ?? markdown.data.subtitle
          ? markdown.data.title + ': ' + markdown.data.subtitle
          : undefined;
      const article = ArticleSchema.safeParse({
        id: markdown.data.id || nanohash(markdown.data),
        name: markdown.data.title,
        date: markdown.data.date,
        headline,
        section: markdown.data.section,
        description: markdown.data.summary,
        publisher: markdown.data.publisher,
        about: markdown.data.about,
        url: markdown.data.url,
        archivedAt: markdown.data.archivedAt,
        text: markdown.content,
      });

      if (article.success) {
        this.articles.push(article.data);
      } else {
        this.log.error(article.error, `Could not parse article`);
        continue;
      }

      if (markdown.data.things) {
        const things = this.prepThings(markdown.data.things);
        await this.saveThings(things);
      }
    }
  }

  override async finalize(): Promise<void> {
    for (const { text, ...frontmatter } of this.articles) {
      const file = this.makeFilename(frontmatter);
      this.output.write(file, { content: text, data: frontmatter });
      if (this.options.store == 'arango') {
        await this.arango.set({ ...frontmatter, text });
      }
      this.log.debug(`Wrote ${file}`);
    }

    await this.copyAssets('images', 'articles');
  }
}
