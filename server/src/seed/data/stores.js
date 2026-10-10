export const stores = [
  {
    name: "Amazon",
    slug: "amazon",
    domain: "amazon.in",
    affiliateConfig: {
      paramStyle: "query",
      template: "tag={partnerTag}",
    },
    active: true,
    sortOrder: 1,
  },
  {
    name: "Flipkart",
    slug: "flipkart",
    domain: "flipkart.com",
    affiliateConfig: {
      paramStyle: "query",
      template: "affid={partnerId}",
    },
    active: true,
    sortOrder: 2,
  },
  {
    name: "Myntra",
    slug: "myntra",
    domain: "myntra.com",
    affiliateConfig: {
      paramStyle: "none",
      template: "",
    },
    active: true,
    sortOrder: 3,
  },
];
