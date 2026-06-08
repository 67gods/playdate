const mongoose = require('mongoose');

const sleepoverSchema = new mongoose.Schema({
  requesterId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipientId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requesterName:        { type: String, required: true },
  requesterColor:       { type: String, required: true },
  requesterEmoji:       { type: String, required: true },
  recipientName:        { type: String, required: true },
  recipientColor:       { type: String, required: true },
  recipientEmoji:       { type: String, required: true },
  date:                 { type: String, required: true },  // YYYY-MM-DD (the night)
  dropOffTime:          { type: String, required: true },  // HH:MM, evening
  pickUpTime:           { type: String, required: true },  // HH:MM, next morning
  hostId:               { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // requesterId or recipientId
  status:               { type: String, enum: ['pending', 'confirmed', 'declined', 'cancelled'], default: 'pending' },
  cancelledBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  parentApprovalNeeded: { type: Boolean, default: false },
  parentApproved:       { type: Boolean, default: false },
  message:              { type: String, default: '' },
  createdAt:            { type: Date, default: Date.now },
});

module.exports = mongoose.model('Sleepover', sleepoverSchema);
