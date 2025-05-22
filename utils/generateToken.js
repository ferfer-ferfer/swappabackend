const jwt = require("jsonwebtoken");

function generateToken(ID_Users) {
  return jwt.sign({ ID_Users }, process.env.JWT_SECRET_KEY, {
    expiresIn: '12h', // or '7d' during dev
  });
}


module.exports = generateToken;