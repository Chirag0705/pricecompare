import dotenv from "dotenv";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  ADMIN_EMAIL: z.string().email("ADMIN_EMAIL must be a valid email"),
  ADMIN_PASSWORD: z
    .string()
    .min(8, "ADMIN_PASSWORD must be at least 8 characters"),
  CORS_ORIGIN: z.string().url().default("http://localhost:5173"),
  AMAZON_ACCESS_KEY: z.string().optional().default(""),
  AMAZON_SECRET_KEY: z.string().optional().default(""),
  AMAZON_PARTNER_TAG: z.string().optional().default(""),
  AMAZON_MARKETPLACE: z.string().optional().default("www.amazon.in"),
  FLIPKART_CLIENT_ID: z.string().optional().default(""),
  FLIPKART_CLIENT_SECRET: z.string().optional().default(""),
  MYNTRA_API_KEY: z.string().optional().default(""),
  MYNTRA_FEED_URL: z.string().url().optional().or(z.literal("")).default(""),
  SYNC_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .default("true"),
  SYNC_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(60000)
    .default(6 * 60 * 60 * 1000),
  SYNC_SEARCH_TERMS: z.string().optional().default("laptop,headphones,smartwatch"),
  REDIS_URL: z.string().optional().default(""),
  TRUST_PROXY: z
    .enum(["true", "false"])
    .optional()
    .default("false"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  console.error(
    `\n[config] Invalid environment variables:\n${issues}\n\n` +
      `Copy server/.env.example to server/.env and fill in the required values.\n`
  );
  process.exit(1);
}

export const env = parsed.data;
