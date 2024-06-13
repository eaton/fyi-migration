import { AccessMigrator } from "./datasets/access-db.js";

await new AccessMigrator({logger:{level:'debug'}}).run();