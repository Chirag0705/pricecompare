import { Router } from "express";
import { z } from "zod";
import { SyncJob, DataQualityIssue } from "../models/index.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { triggerSync } from "../services/scheduler.js";
import { allAdapters } from "../integrations/registry.js";

const router = Router();
router.use(requireAuth, requireRole("admin"));

const triggerSchema = z.object({
  storeSlug: z.enum(["amazon", "flipkart", "myntra"]),
  searchTerms: z.array(z.string().trim().min(1).max(100)).max(10).optional(),
});

const resolveIssueSchema = z.object({
  status: z.enum(["resolved", "ignored", "open"]),
  resolution: z.string().trim().max(1000).optional(),
});

router.get("/sync/jobs", async (req, res, next) => {
  try {
    const { store, status } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const filter = {};
    if (status) filter.status = status;

    const jobs = await SyncJob.find(filter)
      .populate("store", "name slug")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const filtered = store
      ? jobs.filter((j) => j.store?.slug === store)
      : jobs;
    const total = await SyncJob.countDocuments(filter);

    res.json({
      success: true,
      data: { jobs: filtered, page, limit, total },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/sync/jobs/:id", async (req, res, next) => {
  try {
    const job = await SyncJob.findById(req.params.id).populate(
      "store",
      "name slug domain"
    );
    if (!job) {
      return res.status(404).json({
        success: false,
        error: { message: "Sync job not found", code: "NOT_FOUND" },
      });
    }
    res.json({ success: true, data: { job } });
  } catch (err) {
    next(err);
  }
});

router.post("/sync/jobs/trigger", validate(triggerSchema), async (req, res, next) => {
  try {
    const job = await triggerSync(req.body.storeSlug, {
      type: "manual",
      searchTerms: req.body.searchTerms,
    });
    res.status(201).json({ success: true, data: { job } });
  } catch (err) {
    next(err);
  }
});

router.post("/sync/jobs/:id/retry", async (req, res, next) => {
  try {
    const job = await SyncJob.findById(req.params.id).populate("store", "slug");
    if (!job) {
      return res.status(404).json({
        success: false,
        error: { message: "Sync job not found", code: "NOT_FOUND" },
      });
    }
    if (!job.store?.slug) {
      return res.status(400).json({
        success: false,
        error: { message: "Job has no associated store", code: "BAD_REQUEST" },
      });
    }
    const retried = await triggerSync(job.store.slug, { type: "manual" });
    res.status(201).json({ success: true, data: { job: retried } });
  } catch (err) {
    next(err);
  }
});

router.get("/sync/adapters", (_req, res) => {
  res.json({
    success: true,
    data: {
      adapters: allAdapters().map((a) => ({
        slug: a.slug,
        name: a.name,
        configured: a.isConfigured(),
      })),
    },
  });
});

router.get("/data-issues", async (req, res, next) => {
  try {
    const { status, type } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));

    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    const [issues, total] = await Promise.all([
      DataQualityIssue.find(filter)
        .populate("product", "title brand")
        .populate("suggested", "title brand")
        .populate("store", "name slug")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      DataQualityIssue.countDocuments(filter),
    ]);

    res.json({ success: true, data: { issues, page, limit, total } });
  } catch (err) {
    next(err);
  }
});

router.patch(
  "/data-issues/:id",
  validate(resolveIssueSchema),
  async (req, res, next) => {
    try {
      const issue = await DataQualityIssue.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status, resolution: req.body.resolution },
        { new: true, runValidators: true }
      );
      if (!issue) {
        return res.status(404).json({
          success: false,
          error: { message: "Data issue not found", code: "NOT_FOUND" },
        });
      }
      res.json({ success: true, data: { issue } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
