require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const loadConfig = require("./config");
const { connect } = require("./db");
const { authMiddleware } = require("./middleware/auth");
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/auth");
const transactionRoutes = require("./routes/transactions");
const auditRoutes = require("./routes/audit");


async function start() {
  const config = loadConfig();

  await connect(config.mongoUri);
  const app = express();

  app.set("jwtSecret", config.jwtSecret);
  app.set("jwtExpiresIn", config.jwtExpiresIn);

  // Normalize origin for comparison (remove trailing slashes)
  const normalizeOrigin = (origin) => {
    if (!origin) return origin;
    return origin.trim().replace(/\/+$/, "");
  };

  // Get allowed origins as an array for easier checking
  const allowedOrigins = Array.isArray(config.corsOrigin) 
    ? config.corsOrigin.map(normalizeOrigin)
    : [normalizeOrigin(config.corsOrigin)];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
          return callback(null, true);
        }
        
        const normalizedRequestOrigin = normalizeOrigin(origin);
        
        // Check if the normalized origin is in the allowed list
        if (allowedOrigins.includes(normalizedRequestOrigin)) {
          // Return the original request origin to maintain exact match
          return callback(null, origin);
        }
        
        // Origin not allowed
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-CSRF-Token", "Authorization"]
    })
  );
  app.use(helmet());
  app.use(cookieParser());
  app.use(express.json());
  app.use(
    rateLimit({
      windowMs: config.rateLimitWindowMs,
      max: config.rateLimitMax
    })
  );
  app.use(morgan("combined"));

  app.use(authMiddleware);

  app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "arrow-financial-api", timestamp: new Date().toISOString() });
  });
  app.use("/auth", authRoutes);
  app.use("/transactions", transactionRoutes);
  app.use("/audit-logs", auditRoutes);

  app.use(errorHandler);

  app.listen(config.port, () => {
    console.log(`API listening on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});

