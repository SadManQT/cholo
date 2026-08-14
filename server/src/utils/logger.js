function write(method, level, message, context) {
  method(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    }),
  );
}

export const logger = {
  info(message, context = {}) {
    write(console.info, 'info', message, context);
  },

  warn(message, context = {}) {
    write(console.warn, 'warn', message, context);
  },

  error(message, error, context = {}) {
    write(console.error, 'error', message, {
      ...context,
      error: error?.message,
      stack: error?.stack,
    });
  },
};
