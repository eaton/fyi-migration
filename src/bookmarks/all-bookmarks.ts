import { Migrator } from '../shared/migrator.js';
import { AutogramLinkMigrator } from './autogram.js';
import { BrowserBookmarkMigrator } from './browser-bookmarks.js';
import { PocketMigrator } from './getpocket.js';
import { HavanaLinkMigrator } from './havana.js';
import { InstapaperMigrator } from './instapaper.js';
import { OmnivoreMigrator } from './omnivore.js';
import { OpmlMigrator } from './opml.js';
import { PinboardMigrator } from './pinboard.js';
import { PredicateLinkMigrator } from './predicate.js';
import { StaticLinkMigrator } from './static-sites.js';
import { TwitterBookmarkMigrator } from './twitter.js';

export class AllBookmarksMigrator extends Migrator {
  override async run() {
    await new StaticLinkMigrator({ logger: this.log }).run();
    await new PredicateLinkMigrator({ logger: this.log }).run();
    await new HavanaLinkMigrator({ logger: this.log }).run();

    await new BrowserBookmarkMigrator({
      file: '2001-05-28-ie4-favorites.html',
      name: 'ie4',
      label: 'Internet Explorer 4',
      logger: this.log,
      missingDates: 'fake',
      ignore: ['http*://(dev,local)(*,*/**)', '**/*login*', '**/*.apple.com/*'],
    }).run();

    await new OpmlMigrator({
      logger: this.log,
      input: 'input/blogs/movabletype',
      name: 'viapositiva',
      date: new Date(2005, 2, 5),
    }).run();

    await new BrowserBookmarkMigrator({
      file: 'bookmarks-2006-08-19.html',
      name: 'firefox',
      label: 'Firefox',
      logger: this.log,
      missingDates: 'fake',
      ignore: ['http*://(dev,local)(*,*/**)', '**/*login*', '**/*.apple.com/*'],
    }).run();

    await new BrowserBookmarkMigrator({
      file: 'chrome_6_12_24.html',
      name: 'chrome',
      label: 'Google Chrome',
      logger: this.log,
      missingDates: 'fake',
      ignore: ['http*://(dev,local)(*,*/**)', '**/*login*', '**/*.apple.com/*'],
    }).run();

    await new PinboardMigrator({ logger: this.log }).run();
    await new InstapaperMigrator({ logger: this.log }).run();
    await new TwitterBookmarkMigrator({ logger: this.log }).run();
    await new PocketMigrator({ logger: this.log }).run();
    await new AutogramLinkMigrator({ logger: this.log }).run();
    await new OmnivoreMigrator({ logger: this.log }).run();
  }
}
