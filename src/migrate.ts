import { Migrator } from './shared/migrator.js';

import { AllBlogMigrator } from './blogs/all-blogs.js';
import { AllBookmarksMigrator } from './bookmarks/all-bookmarks.js';
import { BookMigrator } from './books/books.js';
import { AllTextFilesMigrator } from './textfiles/all-textfiles.js';
import { TwitterMigrator } from './twitter/twitter.js';
import { ArticleReprintMigrator } from './work/article-reprints.js';
import { AllWorkMigrator } from './work/all-work.js';
import { AllDatasetsMigrator } from './datasets/all-datasets.js';

export class MigrateEverything extends Migrator {
  override async run() {
    await this.arango.initialize();

    await this.arango.collection('thing').truncate();
    await this.arango.collection('link').truncate();
    await this.arango.collection('role').truncate();
    await this.arango.collection('text').truncate();
    await this.arango.collection('url').truncate();
    await this.arango.collection('media').truncate();

    await new AllTextFilesMigrator({ logger: this.log }).run();
    await new AllBlogMigrator({ logger: this.log }).run();
    await new ArticleReprintMigrator({ logger: this.log }).run();
    await new AllBookmarksMigrator({ logger: this.log }).run();
    await new TwitterMigrator({ logger: this.log }).run();
    await new BookMigrator({ logger: this.log }).run();
    await new AllDatasetsMigrator({ logger: this.log }).run();
    await new AllWorkMigrator({ logger: this.log }).run();
    return;
  }
}

await new MigrateEverything({ logger: { level: 'debug' } }).run();
