import { AllBookmarksMigrator } from './bookmarks/all-bookmarks.js';

await new AllBookmarksMigrator().run();
