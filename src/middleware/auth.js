const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function authMiddleware(req, res, next) {
  try {
    // Try to get token from cookie first, then from Authorization header (for mobile fallback)
    let token = req.cookies?.token;
    
    if (!token) {
      // Check Authorization header as fallback for mobile browsers
      const authHeader = req.headers?.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }
    
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
    // Token invalid or expired - silently continue (user not authenticated)
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

