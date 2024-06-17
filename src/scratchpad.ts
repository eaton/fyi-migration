import { PodcastMigrator } from "./work/podcasts.js";
await new PodcastMigrator({ logger: { level: 'debug' }}).run();