const required = [
  "MONGODB_URI",
  "JWT_SECRET",
  "CORS_ORIGIN",
  "CSRF_TOKEN_SECRET"
];

function loadConfig() {
  required.forEach((key) => {
    if (!process.env[key]) {
      throw new Error(`Missing required env var ${key}`);
    }
  });

  return {
    port: process.env.PORT || 4000,
    mongoUri: process.env.MONGODB_URI,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
    corsOrigin: process.env.CORS_ORIGIN,
    csrfTokenSecret: process.env.CSRF_TOKEN_SECRET,
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 200),
    rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000)
  };
}

module.exports = loadConfig;

