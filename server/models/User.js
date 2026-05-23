const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId:          { type: String, required: true, unique: true },
  email:             { type: String, required: true },
  username:          { type: String, unique: true, sparse: true },
  displayName:       { type: String },
  color:             { type: String },
  emoji:             { type: String },
  parentModeEnabled: { type: Boolean, default: false },
  availability:      { type: Map, of: [String], default: {} },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
