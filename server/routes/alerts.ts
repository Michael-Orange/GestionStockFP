import { Router } from "express";
import { storage } from "../storage";
import { logger } from "../middleware/logger";

const router = Router();

router.get("/unread/:userId", async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId);
    const alerts = await storage.getUnreadAlerts(userId);
    res.json(alerts);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/read", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const alert = await storage.markAlertAsRead(id);
    logger.info(`Alerte ${id} marquée comme lue`);
    res.json(alert);
  } catch (error) {
    next(error);
  }
});

export default router;
