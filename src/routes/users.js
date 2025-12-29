const express = require("express");
const bcrypt = require("bcryptjs");
const { requireAuth, requireRole } = require("../middleware/auth");
const csrfProtection = require("../middleware/csrf");
const { logAudit } = require("../utils/auditLogger");
const User = require("../models/User");

const router = express.Router();

// All routes require admin role
router.use(requireAuth);
router.use(requireRole(["admin"]));
router.use(csrfProtection);

// Get all users
router.get("/", async (req, res) => {
  try {
    const users = await User.find({}).select("-passwordHash").sort({ email: 1 });
    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Get single user by ID
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
    }
    return res.json({ user });
  } catch (err) {
    return res.status(500).json({ error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Create new user
router.post("/", async (req, res) => {
  try {
    const { email, password, role } = req.body || {};
    
    if (!email || !password || !role) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "Email, password, and role required" } });
    }
    
    if (!["admin", "taylor", "dad"].includes(role)) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "Invalid role. Must be admin, taylor, or dad" } });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "Invalid email format" } });
    }
    
    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "Password must be at least 6 characters" } });
    }
    
    // Check if user already exists
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: { code: "CONFLICT", message: "User with this email already exists" } });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      role
    });
    
    logAudit({
      userId: req.user.id,
      action: "create",
      timestamp: new Date(),
      after: { userId: user._id, email: user.email, role: user.role },
      meta: { createdUser: user._id.toString() }
    });
    
    return res.status(201).json({ 
      user: { 
        id: user._id, 
        email: user.email, 
        role: user.role,
        createdAt: user.createdAt
      } 
    });
  } catch (err) {
    return res.status(500).json({ error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Update user (email, role, or password)
router.put("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
    }
    
    const { email, password, role } = req.body || {};
    const updates = {};
    const before = user.toObject();
    
    if (email !== undefined) {
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: { code: "VALIDATION", message: "Invalid email" } });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: { code: "VALIDATION", message: "Invalid email format" } });
      }
      
      // Check if email is already taken by another user
      const existing = await User.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: user._id }
      });
      if (existing) {
        return res.status(409).json({ error: { code: "CONFLICT", message: "Email already in use" } });
      }
      
      updates.email = email.toLowerCase();
    }
    
    if (role !== undefined) {
      if (!["admin", "taylor", "dad"].includes(role)) {
        return res.status(400).json({ error: { code: "VALIDATION", message: "Invalid role. Must be admin, taylor, or dad" } });
      }
      updates.role = role;
    }
    
    if (password !== undefined) {
      if (!password || typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ error: { code: "VALIDATION", message: "Password must be at least 6 characters" } });
      }
      updates.passwordHash = await bcrypt.hash(password, 10);
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "No valid fields to update" } });
    }
    
    Object.assign(user, updates);
    await user.save();
    
    const after = user.toObject();
    
    logAudit({
      userId: req.user.id,
      action: "update",
      timestamp: new Date(),
      before: { userId: user._id, email: before.email, role: before.role },
      after: { userId: user._id, email: after.email, role: after.role },
      meta: { updatedUser: user._id.toString(), fieldsUpdated: Object.keys(updates) }
    });
    
    return res.json({ 
      user: { 
        id: user._id, 
        email: user.email, 
        role: user.role 
      } 
    });
  } catch (err) {
    return res.status(500).json({ error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Delete user
router.delete("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
    }
    
    // Prevent deleting yourself
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "Cannot delete your own account" } });
    }
    
    const snapshot = user.toObject();
    await user.deleteOne();
    
    logAudit({
      userId: req.user.id,
      action: "delete",
      timestamp: new Date(),
      before: { userId: snapshot._id, email: snapshot.email, role: snapshot.role },
      after: null,
      meta: { deletedUser: snapshot._id.toString() }
    });
    
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: { code: "SERVER_ERROR", message: err.message } });
  }
});

module.exports = router;

