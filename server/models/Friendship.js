const mongoose = require('mongoose');

const friendshipSchema = new mongoose.Schema({
  fromUserId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromUsername:    { type: String, required: true },
  fromDisplayName: { type: String, required: true },
  fromColor:       { type: String, required: true },
  fromEmoji:       { type: String, required: true },
  toUserId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUsername:      { type: String, required: true },
  status:          { type: String, enum: ['pending', 'accepted'], default: 'pending' },
  createdAt:       { type: Date, default: Date.now },
});

friendshipSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true });

module.exports = mongoose.model('Friendship', friendshipSchema);
