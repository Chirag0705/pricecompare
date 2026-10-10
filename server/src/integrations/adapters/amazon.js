import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { IntegrationError } from "../contract.js";

const SERVICE = "ProductAdvertisingAPI";
const HOST = "webservices.amazon.in";
const REGION = "us-east-1";
const ENDPOINT = `https://${HOST}/paapi5/searchitems`;
const TIMEOUT_MS = 20000;

function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}
function sha256(data) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

/** Real AWS SigV4 signer for PA-API 5.0. */
function signRequest(payloadBody, date) {
  const accessKey = env.AMAZON_ACCESS_KEY;
  const secretKey = env.AMAZON_SECRET_KEY;

  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const canonicalUri = "/paapi5/searchitems";
  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=utf-8\n` +
    `host:${HOST}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:AmazonProductAdvertisingAPIv1.SearchItems\n`;
  const signedHeaders = "content-encoding;content-type;host;x-amz-date;x-amz-target";
  const payloadHash = sha256(payloadBody);

  const canonicalRequest = [
    "POST",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign).toString("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    amzDate,
    authorization,
    payloadHash,
  };
}

function mapItem(item) {
  const info = item.ItemInfo || {};
  const offers = item.Offers?.DisplaySummaries?.[0]?.ListingPrice || {};
  const price = offers.Amount ?? offers.DisplayAmount ?? null;
  const mrp = item.ItemInfo?.ListPrice?.Amount ?? undefined;
  const availability =
    item.Offers?.Listings?.[0]?.Availability?.Message === "Only 1 left in stock."
      ? "in_stock"
      : item.Offers?.DisplaySummaries?.[0]?.Availability?.MaxOrderQuantity
        ? "in_stock"
        : price !== null
          ? "in_stock"
          : "unknown";

  if (price === null || price === undefined) return null;

  return {
    storeProductId: item.ASIN,
    url: item.DetailPageURL,
    affiliateUrl: item.DetailPageURL,
    title: info.Title?.DisplayValue || item.title || "",
    brand: info.ByLineInfo?.Brand?.DisplayValue,
    model: info.ItemInfo?.ProductInfo?.Model?.DisplayValue,
    sku: info.ManufacturerPartsIdentifiers?.[0]?.Value,
    gtin: info.ExternalProductInfo?.ExternalIds?.[0]?.IdValue,
    ean: undefined,
    upc: undefined,
    images: (item.Images?.Primary?.Large?.URL ? [item.Images.Primary.Large.URL] : []),
    color: info.ItemInfo?.Color?.DisplayValue,
    size: info.ItemInfo?.Size?.DisplayValue,
    specs: {},
    price: Number(price),
    mrp: mrp !== undefined && mrp !== null ? Number(mrp) : undefined,
    availability,
    capturedAt: new Date(),
  };
}

export const amazonAdapter = {
  slug: "amazon",
  name: "Amazon",

  isConfigured() {
    return Boolean(
      env.AMAZON_ACCESS_KEY && env.AMAZON_SECRET_KEY && env.AMAZON_PARTNER_TAG
    );
  },

  /**
   * Real PA-API 5.0 SearchItems call. Fetches listings for each search term.
   */
  async fetchListings({ searchTerms = [] } = {}) {
    if (!this.isConfigured()) {
      throw new IntegrationError(
        "Amazon adapter is not configured. Set AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY, and AMAZON_PARTNER_TAG in server/.env.",
        "config"
      );
    }

    const terms = searchTerms.length ? searchTerms : ["laptop", "headphones"];
    const listings = [];

    for (const keywords of terms) {
      const body = JSON.stringify({
        Keywords: keywords,
        PartnerTag: env.AMAZON_PARTNER_TAG,
        PartnerType: "Associates",
        Marketplace: env.AMAZON_MARKETPLACE || "www.amazon.in",
        ItemCount: 10,
        Resources: [
          "Images.Primary.Large",
          "ItemInfo.Title",
          "ItemInfo.ByLineInfo",
          "ItemInfo.Features",
          "ItemInfo.Color",
          "ItemInfo.Size",
          "ItemInfo.ListPrice",
          "ItemInfo.ExternalProductInfo",
          "Offers.Listings",
          "Offers.DisplaySummaries",
        ],
      });

      const date = new Date();
      const { amzDate, authorization, payloadHash } = signRequest(body, date);

      let res;
      try {
        res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            "content-encoding": "amz-1.0",
            "content-type": "application/json; charset=utf-8",
            host: HOST,
            "x-amz-date": amzDate,
            "x-amz-target": "AmazonProductAdvertisingAPIv1.SearchItems",
            "x-amz-content-sha256": payloadHash,
            authorization,
          },
          body,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (err) {
        if (err.name === "TimeoutError" || err.name === "AbortError") {
          throw new IntegrationError(
            `Amazon API timed out after ${TIMEOUT_MS}ms for "${keywords}"`,
            "timeout"
          );
        }
        throw new IntegrationError(
          `Amazon API request failed: ${err.message}`,
          "http"
        );
      }

      if (res.status === 429) {
        throw new IntegrationError("Amazon API rate limit exceeded (429)", "rate_limit");
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new IntegrationError(
          `Amazon API returned ${res.status}: ${text.slice(0, 300)}`,
          "http"
        );
      }

      let data;
      try {
        data = await res.json();
      } catch {
        throw new IntegrationError("Amazon API returned malformed JSON", "parse");
      }

      if (data.Errors?.length) {
        const first = data.Errors[0];
        throw new IntegrationError(
          `Amazon API error ${first.Code}: ${first.Message}`,
          "http",
          data.Errors
        );
      }

      for (const item of data.SearchResult?.Items || []) {
        const mapped = mapItem(item);
        if (mapped) listings.push(mapped);
      }
    }

    return { listings, nextCursor: undefined };
  },
};
