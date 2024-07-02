import { nanohash } from '@eatonfyi/ids';
import { Frontmatter } from '@eatonfyi/serializers';
import { Article, ArticleSchema } from '../schemas/schema-org/CreativeWork/article.js';
import { Migrator, MigratorOptions } from '../shared/migrator.js';
import { toId } from '../shared/schema-meta.js';

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

  override async fillCache() {
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
        id: toId('article', markdown.data.id || nanohash(markdown.data)),
        name: markdown.data.title,
        date: markdown.data.date,
        headline,
        section: markdown.data.section,
        isPartOf: markdown.data.isPartOf,
        description: markdown.data.summary,
        publisher: markdown.data.publisher,
        about: markdown.data.about,
        url: markdown.data.url,
        archivedAt: markdown.data.archivedAt,
        text: markdown.content,
        keywords: markdown.data.keywords
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
    return;
  }

  override async finalize(): Promise<void> {
    for (const article of this.articles) {
        await this.saveThing(article);
        await this.saveThing(article, 'markdown');
    }

    await this.copyAssets('images', 'reprints');
    return;
  }
}
