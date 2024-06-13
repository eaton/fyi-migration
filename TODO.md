# Migration errors and anomolies

## Parsing issues

- [ ] Loads of old LJ posts used table based layouts to format a mosaic of photos. Translating those to use CSS grids or something along those lines would be a nice upgrade.
- [ ] Tumblr id `459649779` has a raw YouTube embed in the body that the `toMarkdown()` function is stripping out rather than keeping as a free-floating URL.
- [ ] Tumblr Link posts often have 'via X…' metadata about the original source of the share. The actual share links are in some weird places, though, and deserve some extra attention. Right now, they're unhandled.
- [x] Pinboard has copies of my Delicious links; deduplicating them and preserving the Delicious attribution would be nice.
