import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

interface AppError extends Error {
  statusCode?: number;
}

function determineStatusCode(error: AppError): number {
  if (error.statusCode) {
    return error.statusCode;
  }

  const message = error.message.toLowerCase();

  if (message.includes("validation") || message.includes("invalid") || message.includes("manquant") || message.includes("requis")) {
    return 400;
  }

  if (message.includes("non trouvé") || message.includes("not found") || message.includes("introuvable") || message.includes("n'existe pas")) {
    return 404;
  }

  if (message.includes("non autorisé") || message.includes("unauthorized") || message.includes("permission")) {
    return 403;
  }

  return 500;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = determineStatusCode(err);

  logger.error(`${req.method} ${req.path} - ${err.message}`, err);

  const response: { error: string; stack?: string } = {
    error: err.message || "Erreur serveur",
  };

  if (process.env.NODE_ENV !== "production") {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
