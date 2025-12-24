function csrfProtection(req, res, next) {
  const method = req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return next();
  if (!req.user) {
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } });
  }
  const headerToken = req.get("X-CSRF-Token");
  if (!headerToken || headerToken !== req.user.csrf) {
    return res.status(403).json({ error: { code: "CSRF", message: "Invalid CSRF token" } });
  }
  return next();
}

module.exports = csrfProtection;

