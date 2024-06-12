
import { BrowserBookmarkMigrator } from "./bookmarks/browser-bookmarks.js";

await new BrowserBookmarkMigrator({
  file: '2001-05-28-ie4-favorites.html',
  name: 'ie4',
  label: 'Internet Explorer 4',
  logger: { level: 'debug' }
}).run();

await new BrowserBookmarkMigrator({
  file: 'bookmarks-2006-08-19.html',
  name: 'firefox',
  label: 'Firefox',
  logger: { level: 'debug' }
}).run();