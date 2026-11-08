// The news outlets Earthlog reads, through their official public RSS feeds (ADR-0017).
// Only the headline, link and time of each item are kept; every headline links to the
// outlet's own article. Feed URLs and terms were checked on 2026-11-08 (see ADR-0017).
// `region` is where the outlet is based: it shows whose eyes a story was seen through and
// which stories only one part of the world covered ("blind spots").

export const REGIONS = [
  "Europe",
  "North America",
  "Middle East",
  "Africa",
  "Asia",
  "Oceania",
] as const;
export type Region = (typeof REGIONS)[number];

export interface Outlet {
  id: string;
  name: string;
  region: Region;
  homepage: string;
  feed: string;
}

export const OUTLETS: Outlet[] = [
  {
    id: "bbc",
    name: "BBC News",
    region: "Europe",
    homepage: "https://www.bbc.com/news",
    feed: "https://feeds.bbci.co.uk/news/world/rss.xml",
  },
  {
    id: "guardian",
    name: "The Guardian",
    region: "Europe",
    homepage: "https://www.theguardian.com/world",
    feed: "https://www.theguardian.com/world/rss",
  },
  {
    id: "sky",
    name: "Sky News",
    region: "Europe",
    homepage: "https://news.sky.com/world",
    feed: "https://feeds.skynews.com/feeds/rss/world.xml",
  },
  {
    id: "dw",
    name: "DW",
    region: "Europe",
    homepage: "https://www.dw.com/en",
    feed: "https://rss.dw.com/rdf/rss-en-all",
  },
  {
    id: "france24",
    name: "France 24",
    region: "Europe",
    homepage: "https://www.france24.com/en/",
    feed: "https://www.france24.com/en/rss",
  },
  {
    id: "aljazeera",
    name: "Al Jazeera",
    region: "Middle East",
    homepage: "https://www.aljazeera.com",
    feed: "https://www.aljazeera.com/xml/rss/all.xml",
  },
  {
    id: "npr",
    name: "NPR",
    region: "North America",
    homepage: "https://www.npr.org/sections/world/",
    feed: "https://feeds.npr.org/1004/rss.xml",
  },
  {
    // Aggregates African outlets; its terms allow headlines on a website with attribution and
    // a link to its home page (https://allafrica.com/misc/tools/rss.html): the site's outlet
    // credits link every outlet's home page.
    id: "allafrica",
    name: "AllAfrica",
    region: "Africa",
    homepage: "https://allafrica.com/",
    feed: "https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf",
  },
];

const BY_ID = new Map(OUTLETS.map((o) => [o.id, o]));

export function outletById(id: string): Outlet | undefined {
  return BY_ID.get(id);
}
