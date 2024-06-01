import { BlogMigrator } from './blogs/blog-migrator.js';
import * as blogs from './blogs/index.js';
// import { ArticleReprintMigrator } from "./misc/article-reprints.js";
import { TwitterMigrator } from './misc/twitter.js';

export class AllBlogs extends BlogMigrator {
  override async run() {
    this.log.level = 'debug';
    await new blogs.TextJournalsMigrator({ logger: this.log }).run();
    await new blogs.PredicateNetMigrator({ logger: this.log }).run();
    await new blogs.LivejournaMigrator({ logger: this.log }).run();
    await new blogs.MovableTypeMigrator({ logger: this.log }).run();
    await new blogs.PositivaDrupalMigrator({ logger: this.log }).run();
    await new blogs.GoddyMigrator({ logger: this.log }).run();
    await new blogs.TumblrMigrator({ logger: this.log }).run();
    await new blogs.AltDrupalMigrator({ logger: this.log }).run();
    await new blogs.AltJekyllMigrator({ logger: this.log }).run();
    await new blogs.MediumMigrator({ logger: this.log }).run();
  }
}

await new TwitterMigrator({ logger: { level: 'debug' } }).run();

// await new AllBlogs().run();
// await new ArticleReprintMigrator({ logger: { level: 'debug' }}).run();
