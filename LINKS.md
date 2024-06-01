# Link Migration

There are *loads* of internal links in these old posts that will need updating. Some specific URL patterns that need love:

| Old URLs | New Path |
| --- | --- |
| `http://(,*.)predicate.net/**/*.(jpg,gif,jpeg))` | `static/predicatenet` |
| `http://(,*.)predicate.(net,org)/users/verb/lj` | `static/lj` |
| `http://(,*.)angrylittletree.com/sites/angrylittletree.com/files/*` | `/static/alt/*` |
| `http://(,*.)angrylittletree.com/files/*` | `/static/alt/*` |
| `http://(,*.)viapositiva.net/**/files/*` | `/static/positiva/*` |
| `http://(,*.)viapositiva.net/**/files/*` | `/static/positiva/*` |
| `http://(,*.)growingupgoddy.com/**/files/*` | `/static/goddy/*` |
| `http://(,*.)skitch.com/*` | `/static/skitch/*` |

Because these occur almost exclusively in blog posts (although there are a fair number of tweets that link to skitch images), having a consistent replacer mechanism probably makes sense.
