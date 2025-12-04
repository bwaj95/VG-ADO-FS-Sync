import * as winston from "winston";

// export const logger = winston.createLogger({
//   level: "info",
//   format: winston.format.combine(
//     winston.format.timestamp(),
//     winston.format.printf(({ level, message, timestamp, ...meta }) => {
//       return `[${timestamp}] ${level.toUpperCase()}: ${message} ${
//         Object.keys(meta).length ? JSON.stringify(meta) : ""
//       }`;
//     })
//   ),
//   transports: [new winston.transports.File({ filename: "logs.log" })],
// });

export const logger = winston.createLogger({
  level: "debug", // capture debug and above
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      // if message is an object (like JSON response), stringify it
      const msg =
        typeof message === "object"
          ? JSON.stringify(message, null, 2)
          : message;

      const extra =
        Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : "";

      return `[${timestamp}] ${level.toUpperCase()}: ${msg} ${extra}`;
    })
  ),
  transports: [
    // Console (pretty for dev)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),

    // File (structured JSON for later analysis)
    new winston.transports.File({
      filename: "logs.log",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(new winston.transports.Console());
}
export const errorLogger = winston.createLogger({
  level: "error",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      let metaString = "";
      try {
        metaString = Object.keys(meta).length ? JSON.stringify(meta) : "";
      } catch (_) {
        metaString = "[Unserializable metadata]";
      }

      return `[${timestamp}] ${level.toUpperCase()}: ${message} ${metaString}`;
    })
  ),
  transports: [new winston.transports.File({ filename: "error.log" })],
});

if (process.env.NODE_ENV !== "production") {
  errorLogger.add(new winston.transports.Console());
}
