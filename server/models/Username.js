const mongoose = require('mongoose');

const usernameSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

module.exports = mongoose.model('Username', usernameSchema);
