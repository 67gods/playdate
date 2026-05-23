const mongoose = require('mongoose');

const playdateSchema = new mongoose.Schema({
  requesterId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipientId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requesterName:        { type: String, required: true },
  requesterColor:       { type: String, required: true },
  requesterEmoji:       { type: String, required: true },
  recipientName:        { type: String, required: true },
  recipientColor:       { type: String, required: true },
  recipientEmoji:       { type: String, required: true },
  date:                 { type: String, required: true },
  timeSlot:             { type: String, required: true },
  type:                 { type: String, enum: ['playdate', 'meeting'], required: true },
  status:               { type: String, enum: ['pending', 'confirmed', 'declined'], default: 'pending' },
  parentApprovalNeeded: { type: Boolean, default: false },
  parentApproved:       { type: Boolean, default: false },
  message:              { type: String, default: '' },
  createdAt:            { type: Date, default: Date.now },
});

module.exports = mongoose.model('Playdate', playdateSchema);
