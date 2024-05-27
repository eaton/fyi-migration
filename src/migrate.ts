
import * as blogs from "./blogs/index.js";

const blog = new blogs.TumblrMigration();
await blog.run();