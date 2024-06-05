import { PartialTweet } from "twitter-archive-reader"

export const isInThread = (tweet: PartialTweet) => true
export const isAncestor = (tweet: PartialTweet) => true
export const isChild = (tweet: PartialTweet) => true
export const isOrphan = (tweet: PartialTweet) => true
export const isReply = (tweet: PartialTweet) => true
export const isRetweet = (tweet: PartialTweet) => true

export const hasMedia = (tweet: PartialTweet) => true
export const hasLinks = (tweet: PartialTweet) => true
export const hasMentions = (tweet: PartialTweet) => true
