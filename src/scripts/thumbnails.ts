import jetpack from '@eatonfyi/fs-jetpack';
import 'dotenv/config';
import SimpleThumbnail from 'simple-thumbnail-ts';
// @ts-expect-error "Default export workaround"
const SimpleThumbnailClass = SimpleThumbnail.default;

const assets = jetpack
  .dir(process.env.MIGRATION_ROOT ?? '')
  .dir(process.env.MIGRATION_ASSETS ?? '');

const thumb = new SimpleThumbnailClass();
for (const video of assets.find({ matching: '**/*.mp4' })) {
  try {
    await thumb.generate(
      assets.path(video),
      assets.path(video) + '.jpeg',
      '450x?',
      {},
    );
    console.log('Done!');
  } catch (err) {
    console.error(err);
  }
}
