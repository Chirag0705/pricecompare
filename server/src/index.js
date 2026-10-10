import { env } from "./config/env.js";
import { connectDB, closeConnection } from "./db/connection.js";
import { createApp } from "./app.js";
import { logger } from "./utils/logger.js";
import { startScheduler, stopScheduler } from "./services/scheduler.js";
import { registerAlertHook } from "./services/alerts.js";
import { initCache, closeCache } from "./services/cache.js";

async function main() {
  await connectDB(env.MONGO_URI);

  registerAlertHook();
  await initCache();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Server listening on http://localhost:${env.PORT}`);
  });

  if (env.SYNC_ENABLED === "true") {
    startScheduler(env.SYNC_INTERVAL_MS);
  } else {
    logger.info("Sync scheduler disabled (SYNC_ENABLED=false)");
  }

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received. Shutting down gracefully...`);
    stopScheduler();
    server.close(async () => {
      await closeConnection();
      await closeCache();
      logger.info("Shutdown complete");
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", reason);
  });
  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception", err.stack || err.message);
    shutdown("uncaughtException");
  });
}

main().catch((err) => {
  logger.error("Fatal startup error", err.message);
  process.exit(1);
});
