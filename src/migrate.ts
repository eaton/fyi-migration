import { Migrator } from './shared/migrator.js';

import { AllBlogMigrator } from './blogs/all-blogs.js';
import { AllBookmarksMigrator } from './bookmarks/all-bookmarks.js';
import { BookMigrator } from './books/books.js';
import { AllDatasetsMigrator } from './datasets/all-datasets.js';
import { AllSocialMigrator } from './social/all-social.js';
import { AllTextFilesMigrator } from './textfiles/all-textfiles.js';
import { AllWorkMigrator } from './work/all-work.js';
import { ArticleReprintMigrator } from './work/article-reprints.js';

export class MigrateEverything extends Migrator {
  override async run() {
    await this.arango.initialize();
    await this.arango.reset(() => Promise.resolve(true));

    // await new AllTextFilesMigrator({ logger: this.log }).run();
    // await new AllBlogMigrator({ logger: this.log }).run();
    // await new ArticleReprintMigrator({ logger: this.log }).run();
    // await new AllBookmarksMigrator({ logger: this.log }).run();
    // await new AllSocialMigrator({ logger: this.log }).run();
    // await new BookMigrator({ logger: this.log }).run();
    // await new AllDatasetsMigrator({ logger: this.log }).run();
    await new AllWorkMigrator({ logger: this.log }).run();
    return;
  }
}

await new MigrateEverything({ logger: { level: 'debug' } }).run();
