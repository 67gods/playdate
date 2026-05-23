const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');
const Playdate = require('../models/Playdate');
const User     = require('../models/User');

function serializePlaydate(pd) {
  return {
    id:                   pd._id.toString(),
    requesterId:          pd.requesterId.toString(),
    recipientId:          pd.recipientId.toString(),
    requesterName:        pd.requesterName,
    requesterColor:       pd.requesterColor,
    requesterEmoji:       pd.requesterEmoji,
    recipientName:        pd.recipientName,
    recipientColor:       pd.recipientColor,
    recipientEmoji:       pd.recipientEmoji,
    date:                 pd.date,
    timeSlot:             pd.timeSlot,
    type:                 pd.type,
    status:               pd.status,
    parentApprovalNeeded: pd.parentApprovalNeeded,
    parentApproved:       pd.parentApproved,
    message:              pd.message,
    createdAt:            pd.createdAt.getTime(),
  };
}

// GET /api/playdates
router.get('/', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const list = await Playdate.find({
      $or: [{ requesterId: userId }, { recipientId: userId }],
    }).sort({ createdAt: -1 });
    res.json(list.map(serializePlaydate));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/playdates
router.post('/', async (req, res) => {
  try {
    const { recipientId, date, timeSlot, type, message } = req.body;
    if (!recipientId || !date || !timeSlot || !type) {
      return res.status(400).json({ error: 'recipientId, date, timeSlot, type required' });
    }

    const [requester, recipient] = await Promise.all([
      User.findById(req.user._id),
      User.findById(recipientId),
    ]);
    if (!requester || !recipient) return res.status(404).json({ error: 'User not found' });

    const pd = await Playdate.create({
      requesterId:          requester._id,
      recipientId:          recipient._id,
      requesterName:        requester.displayName,
      requesterColor:       requester.color,
      requesterEmoji:       requester.emoji,
      recipientName:        recipient.displayName,
      recipientColor:       recipient.color,
      recipientEmoji:       recipient.emoji,
      date,
      timeSlot,
      type,
      status:               'pending',
      parentApprovalNeeded: requester.parentModeEnabled,
      parentApproved:       false,
      message:              message || '',
    });

    res.status(201).json(serializePlaydate(pd));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/playdates/:id/confirm
router.post('/:id/confirm', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const pd = await Playdate.findOneAndUpdate(
      { _id: req.params.id, recipientId: userId, status: 'pending' },
      { status: 'confirmed' },
      { new: true }
    );
    if (!pd) return res.status(404).json({ error: 'Playdate not found' });
    res.json(serializePlaydate(pd));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/playdates/:id/decline
router.post('/:id/decline', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const pd = await Playdate.findOneAndUpdate(
      { _id: req.params.id, recipientId: userId, status: 'pending' },
      { status: 'declined' },
      { new: true }
    );
    if (!pd) return res.status(404).json({ error: 'Playdate not found' });
    res.json(serializePlaydate(pd));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
