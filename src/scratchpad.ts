import { AllWorkMigrator } from "./work/all-work.js";

await new AllWorkMigrator({ logger: { level: 'debug' } }).run();