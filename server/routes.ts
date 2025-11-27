import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { logger } from "./middleware/logger";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";

import authRoutes from "./routes/auth";
import alertsRoutes from "./routes/alerts";
import adminRoutes from "./routes/admin";
import categoriesRoutes from "./routes/categories";
import movementsRoutes from "./routes/movements";
import productsRoutes from "./routes/products";
import listesRoutes from "./routes/listes";
import healthRoutes from "./routes/health";

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(requestLogger);

  app.use("/api/health", healthRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/alerts", alertsRoutes);
  app.use("/api", adminRoutes);
  app.use("/api/categories", categoriesRoutes);
  app.use("/api/movements", movementsRoutes);
  app.use("/api/products", productsRoutes);
  app.use("/api/liste", listesRoutes);

  app.get("/api/users", async (req, res, next) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/units", async (req, res, next) => {
    try {
      const units = await storage.getAllUnits();
      res.json(units);
    } catch (error) {
      next(error);
    }
  });

  app.use(errorHandler);

  const httpServer = createServer(app);
  return httpServer;
}
