import { Migrator } from "../shared/migrator.js";
import { BrowserBookmarkMigrator } from "./browser-bookmarks.js";
import { PinboardMigrator } from "./pinboard.js";
import { InstapaperMigrator } from "./instapaper.js";
import { TwitterBookmarkMigrator } from "./twitter.js";
import { PocketMigrator } from "./getpocket.js";
import { AutogramLinkMigrator } from "./autogram.js";
import { OmnivoreMigrator } from "./omnivore.js";

export class AllBookmarksMigrator extends Migrator {
  override async run() {
    await new BrowserBookmarkMigrator({
      file: '2001-05-28-ie4-favorites.html',
      name: 'ie4',
      label: 'Internet Explorer 4',
      logger: this.log,
      missingDates: 'fake',
      ignore: ['**/*.apple.com/*']
    }).run();
    
    await new BrowserBookmarkMigrator({
      file: 'bookmarks-2006-08-19.html',
      name: 'firefox',
      label: 'Firefox',
      logger: this.log,
      missingDates: 'fake',
      ignore: ['**/*.apple.com/*']
    }).run();

    await new BrowserBookmarkMigrator({
      file: 'chrome_6_12_24.html',
      name: 'chrome',
      label: 'Google Chrome',
      logger: this.log,
      missingDates: 'fake',
      ignore: ['**/*.apple.com/*']
    }).run();

    await new PinboardMigrator({ logger: this.log }).run();
    await new InstapaperMigrator({ logger: this.log }).run();
    await new TwitterBookmarkMigrator({ logger: this.log }).run();
    await new PocketMigrator({ logger: this.log }).run();
    await new AutogramLinkMigrator({ logger: this.log }).run();
    await new OmnivoreMigrator({ logger: this.log }).run();
  }
}