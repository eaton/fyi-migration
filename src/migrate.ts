import { Migrator } from './shared/migrator.js';

import { BookMigrator } from './books/books.js';
import { AllBlogMigrator } from './blogs/all-blogs.js';
import { AllBookmarksMigrator } from './bookmarks/all-bookmarks.js';
import { AllTextFilesMigrator } from './textfiles/all-textfiles.js';
import { ArticleReprintMigrator } from './work/article-reprints.js';
import { TwitterMigrator } from './twitter/twitter.js';
// import { TalkMigrator } from './work/talks.js';


export class MigrateEverything extends Migrator {
  override async run() {
    await new AllTextFilesMigrator({ logger: this.log }).run();
    await new AllBlogMigrator({ logger: this.log }).run();
    await new ArticleReprintMigrator({ logger: this.log }).run();
    await new AllBookmarksMigrator({ logger: this.log }).run();
    await new TwitterMigrator({ logger: this.log }).run();
    await new BookMigrator({ logger: this.log }).run();
    return;
  }
}

await new MigrateEverything({ logger: { level: 'debug' } }).run();