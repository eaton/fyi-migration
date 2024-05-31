
import * as blogs from "./blogs/index.js";
import { BlogMigrator } from "./blogs/blog-migrator.js";
// import { ArticleReprintMigrator } from "./misc/article-reprints.js";

export class AllBlogs extends BlogMigrator {
  override async run() {
    this.log.level = 'debug';
    await new blogs.TextJournalsMigrator({ logger: this.log }).run();
    await new blogs.PredicateNetMigrator({ logger: this.log }).run();
    await new blogs.LivejournaMigrator({ logger: this.log }).run();
    await new blogs.MovableTypeMigrator({ logger: { level: 'debug' }}).run();
    await new blogs.PositivaDrupalMigrator({ logger: { level: 'debug' }}).run();
    await new blogs.GoddyMigrator({ logger: { level: 'debug' }}).run();
    await new blogs.TumblrMigrator({ logger: this.log }).run();
    await new blogs.AltDrupalMigrator({ logger: this.log }).run();
    await new blogs.AltJekyllMigrator({ logger: this.log }).run();
    await new blogs.MediumMigrator({ logger: this.log }).run();
  }
}

// await new AllBlogs().run();
// await new ArticleReprintMigrator({ logger: { level: 'debug' }}).run();