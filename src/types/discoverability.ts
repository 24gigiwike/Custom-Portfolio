/** Optional public facts for search and AI discovery. These are not a second profile. */
export type PortfolioIdentity = "" | "person" | "organization";

export type PortfolioFaq = {
  question: string;
  answer: string;
};

export type PortfolioDiscoverability = {
  identity: PortfolioIdentity;
  serviceRegion: string;
  faqs: PortfolioFaq[];
};
