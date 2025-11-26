type LogMeta = Record<string, unknown>;

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatMeta(meta?: LogMeta | Error): string {
  if (!meta) return "";
  if (meta instanceof Error) {
    return ` [${meta.message}]${meta.stack ? `\n${meta.stack}` : ""}`;
  }
  return ` ${JSON.stringify(meta)}`;
}

export const logger = {
  info(message: string, meta?: LogMeta): void {
    console.log(`[INFO] ${formatTimestamp()} - ${message}${formatMeta(meta)}`);
  },

  error(message: string, error?: Error | LogMeta): void {
    console.error(`[ERROR] ${formatTimestamp()} - ${message}${formatMeta(error)}`);
  },

  warn(message: string, meta?: LogMeta): void {
    console.warn(`[WARN] ${formatTimestamp()} - ${message}${formatMeta(meta)}`);
  },
};
