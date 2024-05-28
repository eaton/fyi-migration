
import * as blogs from "./blogs/index.js";

const blog = new blogs.AltDrupalMigrator();
await blog.clearCache();
await blog.run();