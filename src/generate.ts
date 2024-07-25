import { ThingMigrator, PostGenerator, SocialGenerator, CommentGenerator, TalkGenerator } from "./generators/index.js";

await new ThingMigrator({ logger: { level: 'debug' } }).run();
await new PostGenerator({ logger: { level: 'debug' } }).run();
await new SocialGenerator({ logger: { level: 'debug' } }).run();
await new CommentGenerator({ logger: { level: 'debug' } }).run();
await new TalkGenerator({ logger: { level: 'debug' } }).run();
