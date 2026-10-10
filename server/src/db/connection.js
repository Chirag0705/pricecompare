import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

const RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2000;

let reconnectAttempts = 0;
let intentionalClose = false;

export async function connectDB(uri) {
  mongoose.set("strictQuery", true);
  intentionalClose = false;

  mongoose.connection.on("connected", () => {
    logger.info("MongoDB connected");
    reconnectAttempts = 0;
  });

  mongoose.connection.on("disconnected", () => {
    if (intentionalClose) return;
    logger.warn("MongoDB disconnected");
    attemptReconnect(uri);
  });

  mongoose.connection.on("error", (err) => {
    logger.error("MongoDB connection error", err.message);
  });

  for (let attempt = 1; attempt <= RECONNECT_ATTEMPTS; attempt++) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      return mongoose.connection;
    } catch (err) {
      logger.error(
        `MongoDB connection attempt ${attempt}/${RECONNECT_ATTEMPTS} failed`,
        err.message
      );
      if (attempt === RECONNECT_ATTEMPTS) {
        throw new Error(
          `Could not connect to MongoDB after ${RECONNECT_ATTEMPTS} attempts: ${err.message}`
        );
      }
      await sleep(RECONNECT_DELAY_MS * attempt);
    }
  }
}

async function attemptReconnect(uri) {
  if (reconnectAttempts >= RECONNECT_ATTEMPTS) return;
  reconnectAttempts += 1;
  const delay = RECONNECT_DELAY_MS * reconnectAttempts;
  logger.info(
    `Reconnecting to MongoDB in ${delay}ms (attempt ${reconnectAttempts}/${RECONNECT_ATTEMPTS})`
  );
  await sleep(delay);
  if (intentionalClose) return;
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
  } catch (err) {
    logger.error("MongoDB reconnect failed", err.message);
  }
}

export async function closeConnection() {
  intentionalClose = true;
  await mongoose.connection.close();
  logger.info("MongoDB connection closed");
}

export function getDBState() {
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };
  return states[mongoose.connection.readyState] || "unknown";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
