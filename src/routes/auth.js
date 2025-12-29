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
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/"
  });
  user.lastLoginAt = new Date();
  await user.save();
  logAudit({
    userId: user._id,
    action: "login",
    timestamp: new Date(),
    meta: { ip: req.ip, ua: req.get("user-agent") }
  });
  return res.json({ user: { id: user._id, email: user.email, role: user.role }, csrfToken });
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
    partitioned: true,
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


