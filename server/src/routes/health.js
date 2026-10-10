import { Router } from "express";
import { getDBState } from "../db/connection.js";

const router = Router();

router.get("/", (_req, res) => {
  const dbState = getDBState();
  const payload = {
    status: dbState === "connected" ? "ok" : "degraded",
    uptime: Math.round(process.uptime()),
    database: dbState,
    timestamp: new Date().toISOString(),
  };
  const statusCode = dbState === "connected" ? 200 : 503;
  res.status(statusCode).json({ success: statusCode === 200, data: payload });
});

export default router;
