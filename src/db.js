const mongoose = require("mongoose");

async function connect(mongoUri) {
  await mongoose.connect(mongoUri, {
    autoIndex: true
  });
  return mongoose.connection;
}

module.exports = { connect };

