function errorHandler(err, req, res, next) {
  // eslint-disable-line no-unused-vars
  console.error(err);
  const status = err.status || 500;
  const code = err.code || "INTERNAL_ERROR";
  const message = err.message || "Unexpected error";
  return res.status(status).json({ error: { code, message, requestId: req.id } });
}

module.exports = errorHandler;

