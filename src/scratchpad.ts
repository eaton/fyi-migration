import { PinboardMigrator } from "./bookmarks/pinboard.js";

await new PinboardMigrator({ logger: { level: 'debug' }}).run();