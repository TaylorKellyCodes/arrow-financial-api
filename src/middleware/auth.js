const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function authMiddleware(req, res, next) {
  try {
    const token = req.cookies?.token;
    if (!token) return next();
    const payload = jwt.verify(token, req.app.get("jwtSecret"));
    const user = await User.findById(payload.sub);
    if (!user) return next();
    req.user = {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      csrf: payload.csrf
    };
    next();
  } catch (err) {
    return next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } });
  }
  return next();
}

function requireRole(roles) {
  return function roleCheck(req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Not authorized" } });
    }
    return next();
  };
}

function canEditCheckbox(reqBodyField, userRole) {
  if (userRole === "admin") return true;
  if (reqBodyField === "confirmationTaylor" && userRole === "taylor") return true;
  if (reqBodyField === "confirmationDad" && userRole === "dad") return true;
  return false;
}

module.exports = { authMiddleware, requireAuth, requireRole, canEditCheckbox };

