// This is for reading the raw twitter archive data files, a thing that is horrifyingly necessary because the world is full of pain.

const example = [{
  "tweet" : {
    "retweeted" : false,
    "source" : "<a href=\"https://mobile.twitter.com\" rel=\"nofollow\">Twitter Web App</a>",
    "entities" : {
      "user_mentions" : [
        {
          "name" : "Dave Reid",
          "screen_name" : "davereid",
          "id_str" : "1158961",
          "id" : "1158961"
        }
      ],
      "urls" : [
        {
          "url" : "http://t.co/QpGSuK0",
          "expanded_url" : "http://www.howto.gov/web-content/technology/content-management-systems/how-to-create-open-structured-content",
          "display_url" : "howto.gov/web-content/te…",
        }
      ],
    },
    "favorite_count" : "0",
    "id_str" : "1267477790099755012",
    "truncated" : false,
    "retweet_count" : "0",
    "id" : "1267477790099755012",
    "created_at" : "Mon Jun 01 15:27:08 +0000 2020",
    "full_text" : "company town hall meeting:\n\n10:02: \"So, I don't have any prepared statements but we're going to wing it here…\" STRESS LEVELS RISE\n\n10:04: \"In conclusion, have your contact info written in sharpie on your arm, wear goggles, LMK if you need cover for client hours.\" https://t.co/meTdcjoFMQ",
    "extended_entities" : {
      "media" : [
        {
          "expanded_url" : "https://twitter.com/schmeaton/status/1267477790099755012/photo/1",
          "url" : "https://t.co/meTdcjoFMQ",
          "media_url" : "http://pbs.twimg.com/tweet_video_thumb/EZb8VGVX0AMLxyH.jpg",
          "id_str" : "1267477784559079427",
          "video_info" : {
            "variants" : [
              {
                "bitrate" : "0",
                "content_type" : "video/mp4",
                "url" : "https://video.twimg.com/tweet_video/EZb8VGVX0AMLxyH.mp4"
              }
            ]
          },
          "id" : "1267477784559079427",
          "media_url_https" : "https://pbs.twimg.com/tweet_video_thumb/EZb8VGVX0AMLxyH.jpg",
          "type" : "animated_gif",
          "display_url" : "pic.twitter.com/meTdcjoFMQ"
        }
      ]
    }
  }
}];