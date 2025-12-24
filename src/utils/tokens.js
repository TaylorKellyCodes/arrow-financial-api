const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

function generateTokens(user, jwtSecret, jwtExpiresIn) {
  const csrfToken = uuidv4();
  const token = jwt.sign(
    { sub: user._id.toString(), role: user.role, csrf: csrfToken },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
  return { token, csrfToken };
}

function verifyJwt(token, jwtSecret) {
  return jwt.verify(token, jwtSecret);
}

module.exports = { generateTokens, verifyJwt };

