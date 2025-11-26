import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  logger.info(`${req.method} ${req.path}`);

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const statusEmoji = statusCode >= 400 ? "⚠️" : "✓";
    
    logger.info(`${statusEmoji} ${req.method} ${req.path} ${statusCode} in ${duration}ms`);
  });

  next();
}
