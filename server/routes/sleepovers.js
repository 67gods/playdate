const express   = require('express');
const router    = express.Router();
const mongoose  = require('mongoose');
const Sleepover = require('../models/Sleepover');
const User      = require('../models/User');

function serializeSleepover(so) {
  return {
    id:                   so._id.toString(),
    requesterId:          so.requesterId.toString(),
    recipientId:          so.recipientId.toString(),
    requesterName:        so.requesterName,
    requesterColor:       so.requesterColor,
    requesterEmoji:       so.requesterEmoji,
    recipientName:        so.recipientName,
    recipientColor:       so.recipientColor,
    recipientEmoji:       so.recipientEmoji,
    date:                 so.date,
    dropOffTime:          so.dropOffTime,
    pickUpTime:           so.pickUpTime,
    hostId:               so.hostId.toString(),
    status:               so.status,
    cancelledBy:          so.cancelledBy ? so.cancelledBy.toString() : null,
    parentApprovalNeeded: so.parentApprovalNeeded,
    parentApproved:       so.parentApproved,
    message:              so.message,
    createdAt:            so.createdAt.getTime(),
  };
}

// GET /api/sleepovers
router.get('/', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const list = await Sleepover.find({
      $or: [{ requesterId: userId }, { recipientId: userId }],
    }).sort({ createdAt: -1 });
    res.json(list.map(serializeSleepover));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/sleepovers
router.post('/', async (req, res) => {
  try {
    const { recipientId, date, dropOffTime, pickUpTime, host, message } = req.body;
    if (!recipientId || !date || !dropOffTime || !pickUpTime || !host) {
      return res.status(400).json({ error: 'recipientId, date, dropOffTime, pickUpTime, host required' });
    }
    if (host !== 'me' && host !== 'them') {
      return res.status(400).json({ error: "host must be 'me' or 'them'" });
    }

    const [requester, recipient] = await Promise.all([
      User.findById(req.user._id),
      User.findById(recipientId),
    ]);
    if (!requester || !recipient) return res.status(404).json({ error: 'User not found' });

    const hostId = host === 'me' ? requester._id : recipient._id;

    const so = await Sleepover.create({
      requesterId:          requester._id,
      recipientId:          recipient._id,
      requesterName:        requester.displayName,
      requesterColor:       requester.color,
      requesterEmoji:       requester.emoji,
      recipientName:        recipient.displayName,
      recipientColor:       recipient.color,
      recipientEmoji:       recipient.emoji,
      date,
      dropOffTime,
      pickUpTime,
      hostId,
      status:               'pending',
      parentApprovalNeeded: requester.parentModeEnabled,
      parentApproved:       false,
      message:              message || '',
    });

    res.status(201).json(serializeSleepover(so));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sleepovers/:id/confirm
router.post('/:id/confirm', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const so = await Sleepover.findOneAndUpdate(
      { _id: req.params.id, recipientId: userId, status: 'pending' },
      { status: 'confirmed' },
      { new: true }
    );
    if (!so) return res.status(404).json({ error: 'Sleepover not found' });
    res.json(serializeSleepover(so));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/sleepovers/:id/decline
router.post('/:id/decline', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const so = await Sleepover.findOneAndUpdate(
      { _id: req.params.id, recipientId: userId, status: 'pending' },
      { status: 'declined' },
      { new: true }
    );
    if (!so) return res.status(404).json({ error: 'Sleepover not found' });
    res.json(serializeSleepover(so));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/sleepovers/:id/cancel — either participant, while pending or confirmed
router.post('/:id/cancel', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const so = await Sleepover.findOneAndUpdate(
      {
        _id: req.params.id,
        $or: [{ requesterId: userId }, { recipientId: userId }],
        status: { $in: ['pending', 'confirmed'] },
      },
      { status: 'cancelled', cancelledBy: userId },
      { new: true }
    );
    if (!so) return res.status(404).json({ error: 'Sleepover not found' });
    res.json(serializeSleepover(so));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
