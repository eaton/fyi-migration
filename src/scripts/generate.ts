import {
  ArticleGenerator,
  CommentGenerator,
  PostGenerator,
  ProjectGenerator,
  SocialGenerator,
  TalkGenerator,
  ThingGenerator,
} from '../generators/index.js';
import { TextGenerator } from '../generators/textfiles.js';

await new ThingGenerator().run();
await new PostGenerator().run();
await new ArticleGenerator().run();
await new SocialGenerator({ threadMinLength: 5, singleMinFavorites: 50 }).run();
await new CommentGenerator().run();
await new TalkGenerator().run();
await new ProjectGenerator().run();
await new TextGenerator().run();
