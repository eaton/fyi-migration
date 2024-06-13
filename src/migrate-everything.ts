import { BookMigrator } from './books/books.js';
import { AllBlogMigrator } from './blogs/all-blogs.js';
import { AllBookmarksMigrator } from './bookmarks/all-bookmarks.js';
import { AllTextFilesMigrator } from './textfiles/all-textfiles.js';

import { Migrator } from './shared/migrator.js';

export class MigrateEverything extends Migrator {
  override async run() {
    await new AllBlogMigrator({ logger: this.log }).run();
    await new AllBookmarksMigrator({ logger: this.log }).run();
    await new AllTextFilesMigrator({ logger: this.log }).run();
    await new BookMigrator({ logger: this.log }).run();
    return;
  }
}