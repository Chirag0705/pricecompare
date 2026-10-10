const timestamp = () => new Date().toISOString();

export const logger = {
  info(message, meta) {
    console.log(
      `[${timestamp()}] INFO  ${message}`,
      meta !== undefined ? meta : ""
    );
  },
  warn(message, meta) {
    console.warn(
      `[${timestamp()}] WARN  ${message}`,
      meta !== undefined ? meta : ""
    );
  },
  error(message, meta) {
    console.error(
      `[${timestamp()}] ERROR ${message}`,
      meta !== undefined ? meta : ""
    );
  },
  debug(message, meta) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(
        `[${timestamp()}] DEBUG ${message}`,
        meta !== undefined ? meta : ""
      );
    }
  },
};
