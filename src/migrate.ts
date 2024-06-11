import * as blogs from './blogs/index.js';
import { BookMigrator } from './books/books.js';
import { Migrator } from './shared/migrator.js';
import * as textfiles from './textfiles/index.js';
import { TwitterMigrator } from './twitter/twitter.js';
import { ArticleReprintMigrator } from './work/article-reprints.js';
import { TalkMigrator } from './work/talks.js';

export class AllMigrations extends Migrator {
  override async run() {
    this.log.level = 'debug';

    await new blogs.PredicateNetMigrator({ logger: this.log }).run();
    await new blogs.LivejournaMigrator({ logger: this.log }).run();
    await new blogs.FuturismMigrator({ logger: this.log }).run();
    await new blogs.MovableTypeMigrator({ logger: this.log }).run();
    await new blogs.PositivaDrupalMigrator({ logger: this.log }).run();
    await new blogs.GoddyMigrator({ logger: this.log }).run();
    await new blogs.TumblrMigrator({ logger: this.log }).run();
    await new blogs.AltDrupalMigrator({ logger: this.log }).run();
    await new blogs.AltJekyllMigrator({ logger: this.log }).run();
    await new blogs.MediumMigrator({ logger: this.log }).run();

    await new ArticleReprintMigrator({ logger: this.log }).run();
    await new textfiles.TextJournalsMigrator({ logger: this.log }).run();
    await new textfiles.TextFictionMigrator({ logger: this.log }).run();
    await new textfiles.TextEmailMigrator({ logger: this.log }).run();

    await new TwitterMigrator({ logger: this.log }).run();
    await new TwitterMigrator({ logger: this.log }).run();

    await new TalkMigrator({ logger: this.log }).run();
  }
}

await new BookMigrator({ logger: { level: 'debug' } }).run();
