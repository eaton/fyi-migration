# Eaton FYI migration scripts

A cluster of kludgy migration tools and content transformers to move all of my old crap to new, unified digs. For the first pass, it's spitting out a staggering number of markdown files for use on an Eleventy site; the presence of an a embryonic key/value and graph data framework in the `storage` folder of this project betrays my long-term ambitions, though, so this is all set up to be re-runnable with different endpoints as needed.

What's in-scope? An awful lot of stuff. Long term this will likely be split out into a few different forms. Twitter posts, for example, don't make a lot of sense sandwiched into my personal site.

## Oldschool Sites

- [ ] The AOL.com era
- [ ] wwa.com
  - [ ] home page permutations and redesigns
  - [ ] Hope Station, Hope Station Phoenix
  - [ ] Cornerstone: Off The Beaten Path
- [ ] dancingmongoose.com
- [ ] ferretshock.com
- [ ] predicate.net
- [ ] predicate.org, when it was my personal site
- [ ] havana-mod.com, when it was a pseudo-aggregator

## Blogs

Posts and entries from the assorted places I've written over the years. These are being imported as `post` content in Eleventy.

`Textfiles` and `Livejournal` in particular will probably need some post-migration curation and careful consideration. Many of those posts were never intended to be publicly published, are extremely full of teen and post-college cringe, or contain snippets of personal information about folks who probably didn't anticipate their melodrama spilling out.

- [ ] Textfiles covering the mid-late 90s
- [ ] THE LIST, a small-distribution listserv lists that served as a pseudo-blog
- [x] Livejournal (minus Textfiles reprints)
- [ ] MovableType
  - [ ] Viapositiva
  - [ ] Reading Life
  - [ ] Futurism
- [x] Tumblr (PLF, Govertainment, CMS Whoops, To My Former Self)
- [ ] Medium (minus Growing Up Goddy reprints)
- [ ] Drupal
  - [ ] Via Positiva
  - [x] ALT
  - [x] Growing Up Goddy
  - [ ] Kirkegaard Lips
- [x] Jekyll (Angry Little Tree)
- [ ] Disqus comments spread across both iterations of the AngryLittleTree site

## Social Media

 The destination format for these varies. Twitter/Mastodon threads are turned into `post` content, as are LinkedIn posts. Usenet is kind of a weird beast, and MetaFilter is probably just there for accurate calculation of stats, though select posts and comments will likely be reprinted.

- [ ] Twitter
- [ ] Mastodon
- [ ] Bluesky
- [ ] Facebook
- [ ] Usenet
- [ ] Metafilter

## Photos

Whenever possible I'll lean on hotlinking to Flickr for the large photos; keeping them local is likely to be horrifyingly bandwidth intensive.

- [ ] Livejournal photo posts
- [ ] Instagram selections
- [ ] Flickr selections
- [ ] iCloud Photo selections

## Appearances

Places I've written, presented, been quoted, and so on.

- [ ] Talks and presentations
- [ ] Podcast appearances
- [ ] Citations and quotes
- [ ] Article reprints
  - [ ] Lullabot
  - [ ] Pastry Box
  - [ ] Mac Action
  - [ ] Inside Mac Games
  - [ ] Misc freelancing and one-offs

## Projects

This is a very, very wacky grab bag and covers things I've done for funsies as well as work projects.

- [ ] Insert Content Here
- [ ] Christian Rightcast
- [ ] Quarantoons
- [ ] Web Sites
- [ ] The Icebox (my extremely old sites)
- [ ] Software
- [ ] Kidstuff
- [ ] Worlds
  - [ ] Hope Station / Phoenix
  - [ ] Havana Mod
  - [ ] One Hundred Words
  - [ ] Tainted Networks
  - [ ] Landscape
  - [ ] Eclipse Phase
- [ ] Brambleberry Workshop

## Work History

Employment timeline; this is less of a primary focus and more splashover data from the project archive.

- [ ] Kidstuff
- [ ] America Online
- [ ] Robis
- [ ] Willow Creek
- [ ] Geneer
- [ ] Retail Vision Systems
- [ ] Lullabot
  - [ ] Buzzr (AKA Project Codename)
- [ ] Autogram

## Links

Saved and shared links over the years. Accurately capturing the dates/times, and distinguishing between "bookmarks" and "links that happened to be mentioned" is tricky. Some of these will also need to be removed from the dataset as they were only meant to be personal/local bookmarks and contain links to client staging sites, work intranets, etc.

- [ ] Delicious
- [ ] Pinboard
- [ ] Twitter
- [ ] Instapaper
- [ ] Blogrolls
- [ ] Autogram Links
- [ ] Old sites (MDB files & HTML extraction)

## Stats

Arbitrary but interesting stuff I'll be doing some dataviz and explanitory posts about.

- [ ] Travel
- [ ] Email
- [ ] Words / Topics / Language
- [ ] Linkrot
- [ ] Twitter Engagement

## Timelines

These will be used to populate 'on this day/week' and other contextual cues around my own posts.

- [ ] Conferences
- [ ] Technology
- [ ] Politics
- [ ] Content management
- [ ] Personal hardware
- [ ] Rapture media

## Facts

These are basically a database of supporting facts that can be used to populate Schema.org data and used to cross-link entris and other content that mentions them. `Books` in particular will be used to construct a reading room view of my library, and `People` will be used to deduplicate references to folks I know in tweets, old posts, and so on.

- [ ] Books
  - [ ] TTRPG books
  - [ ] Comics/Graphic Novels
- [ ] Games
- [ ] Films
- [ ] People
- [ ] Organizations
- [ ] Places
- [ ] Events
