import { Thing } from '../schemas';

const thingTypeLookup = {
  AmpStory: 'CreativeWork',
  ArchiveComponent: 'CreativeWork',
  Article: 'CreativeWork',
  AdvertiserContentArticle: 'CreativeWork',
  NewsArticle: 'CreativeWork',
  AnalysisNewsArticle: 'CreativeWork',
  AskPublicNewsArticle: 'CreativeWork',
  BackgroundNewsArticle: 'CreativeWork',
  OpinionNewsArticle: 'CreativeWork',
  ReportageNewsArticle: 'CreativeWork',
  ReviewNewsArticle: 'CreativeWork',
  Report: 'CreativeWork',
  SatiricalArticle: 'CreativeWork',
};

function binForType(thing: string | Thing) {}
