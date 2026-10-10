import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import adminSyncRouter from "./adminSync.js";
import adminProductsRouter from "./adminProducts.js";
import adminStoresRouter from "./adminStores.js";
import adminUsersRouter from "./adminUsers.js";
import adminInsightsRouter from "./adminInsights.js";
import catalogRouter from "./catalog.js";
import wishlistRouter from "./wishlist.js";
import alertsRouter from "./alerts.js";
import notificationsRouter from "./notifications.js";
import imagesRouter from "./images.js";

const router = Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/admin", adminSyncRouter);
router.use("/admin", adminProductsRouter);
router.use("/admin", adminStoresRouter);
router.use("/admin", adminUsersRouter);
router.use("/admin", adminInsightsRouter);
router.use("/wishlist", wishlistRouter);
router.use("/alerts", alertsRouter);
router.use("/notifications", notificationsRouter);
router.use("/", imagesRouter);
router.use("/", catalogRouter);

export default router;
