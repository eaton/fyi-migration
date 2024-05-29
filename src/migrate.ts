
import * as blogs from "./blogs/index.js";
import { BlogMigrator } from "./blogs/blog-migrator.js";
import { DisqusMigrator } from "./misc/disqus/disqus.js";

export class AllBlogs extends BlogMigrator {
  override async run() {
    this.log.level = 'debug';
    await new blogs.TextfilesMigrator({ logger: this.log }).run();
    await new blogs.LivejournaMigrator({ logger: this.log }).run();
    await new blogs.PredicateNetMigrator({ logger: this.log }).run();
    await new blogs.AltDrupalMigrator({ logger: this.log }).run();
    await new blogs.TumblrMigrator({ logger: this.log }).run();
    await new blogs.AltJekyllMigrator({ logger: this.log }).run();
  }
}

// await new AllBlogs().run();
// await new blogs.GoddyMigrator({ logger: { level: 'debug' }}).run();

await new DisqusMigrator({ logger: { level: 'debug' }}).run();