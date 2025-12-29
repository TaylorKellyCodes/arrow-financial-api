const express = require("express");
const bcrypt = require("bcryptjs");
const { generateTokens } = require("../utils/tokens");
const { logAudit } = require("../utils/auditLogger");
const User = require("../models/User");

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res
      .status(400)
      .json({ error: { code: "VALIDATION", message: "Email and password required" } });
  }
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid login" } });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid login" } });
  }
  const { token, csrfToken } = generateTokens(user, req.app.get("jwtSecret"), req.app.get("jwtExpiresIn"));
  
  // Calculate maxAge from JWT expiresIn (default 1h = 3600000ms)
  const expiresIn = req.app.get("jwtExpiresIn") || "1h";
  let maxAge = 3600000; // default 1 hour
  if (expiresIn.includes("h")) {
    maxAge = parseInt(expiresIn) * 3600000;
  } else if (expiresIn.includes("d")) {
    maxAge = parseInt(expiresIn) * 24 * 3600000;
  } else if (expiresIn.includes("m")) {
    maxAge = parseInt(expiresIn) * 60000;
  }
  
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/",
    maxAge: maxAge,
    // Don't set domain - let browser handle it
  });
  user.lastLoginAt = new Date();
  await user.save();
  logAudit({
    userId: user._id,
    action: "login",
    timestamp: new Date(),
    meta: { ip: req.ip, ua: req.get("user-agent") }
  });
  // Also return token in response for mobile browsers that can't use cookies
  return res.json({ 
    user: { id: user._id, email: user.email, role: user.role }, 
    csrfToken,
    token // Include token in response for localStorage fallback
  });
});

router.post("/logout", async (req, res) => {
  if (req.user) {
    logAudit({
      userId: req.user.id,
      action: "logout",
      timestamp: new Date(),
      meta: { ip: req.ip, ua: req.get("user-agent") }
    });
  }
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/"
  });
  return res.json({ success: true });
});

router.get("/me", (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } });
  }
  // Return user info and CSRF token so frontend can restore session
  return res.json({ 
    user: { id: req.user.id, email: req.user.email, role: req.user.role },
    csrfToken: req.user.csrf
  });
});

// Development-only endpoint to create test users
if (process.env.NODE_ENV !== "production") {
  router.post("/create-test-user", async (req, res) => {
    try {
      const { email = "test@test.com", password = "test", role = "admin" } = req.body || {};
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.json({ 
          exists: true, 
          userId: existing._id,
          message: "User already exists"
        });
      }
      const hash = await bcrypt.hash(password, 10);
      const user = await User.create({
        email: email.toLowerCase(),
        passwordHash: hash,
        role
      });
      res.json({ created: true, userId: user._id, email: user.email, role: user.role });
    } catch (err) {
      res.status(500).json({ error: { code: "SERVER_ERROR", message: err.message } });
    }
  });
}

module.exports = router;


