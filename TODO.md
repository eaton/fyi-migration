# Migration errors and anomolies

## Parsing issues

- [ ] Loads of old LJ posts used table based layouts to format a mosaic of photos. Translating those to use CSS grids or something along those lines would be a nice upgrade.
- [ ] Tumblr id `459649779` has a raw YouTube embed in the body that the `toMarkdown()` function is stripping out rather than keeping as a free-floating URL.
- [ ] Tumblr Link posts often have 'via X…' metadata about the original source of the share. The actual share links are in some weird places, though, and deserve some extra attention. Right now, they're unhandled.
- [x] Pinboard has copies of my Delicious links; deduplicating them and preserving the Delicious attribution would be nice.
- [x] Clean generation of 'threaded sort-order' keyes for arbitrary comments is now in place. Woo. It duplicates Drupal's comment-sort ID generator, and works on imported Disqus threads as well. I'll be using it on Twitter threads as well, to preserve hierarchy on threads with weird discursive sub-trees of interspersed replies.
  - [ ] Right now it's hard coded to use `id`, `parent`, and `thread` properties: that works with the CommentSchema entity but for other data it'd be nice to make it configurable.
