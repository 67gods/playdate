const express    = require('express');
const router     = express.Router();
const mongoose   = require('mongoose');
const Friendship = require('../models/Friendship');
const User       = require('../models/User');

function serializeFriend(user) {
  return {
    uid:          user._id.toString(),
    username:     user.username,
    displayName:  user.displayName,
    color:        user.color,
    emoji:        user.emoji,
    availability: Object.fromEntries(user.availability || new Map()),
  };
}

function serializeFriendRequest(fs) {
  return {
    id:              fs._id.toString(),
    fromUid:         fs.fromUserId.toString(),
    fromUsername:    fs.fromUsername,
    fromDisplayName: fs.fromDisplayName,
    fromColor:       fs.fromColor,
    fromEmoji:       fs.fromEmoji,
    toUid:           fs.toUserId.toString(),
    toUsername:      fs.toUsername,
    status:          fs.status,
    createdAt:       fs.createdAt.getTime(),
  };
}

// GET /api/friends
router.get('/', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const friendships = await Friendship.find({
      $or: [{ fromUserId: userId }, { toUserId: userId }],
      status: 'accepted',
    });

    const friendIds = friendships.map(fs =>
      fs.fromUserId.equals(userId) ? fs.toUserId : fs.fromUserId
    );

    const users = await User.find({
      _id: { $in: friendIds },
      username: { $exists: true, $ne: null },
    });
    res.json(users.map(serializeFriend));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/friends/requests
router.get('/requests', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const pending = await Friendship.find({
      $or: [{ fromUserId: userId }, { toUserId: userId }],
      status: 'pending',
    });
    res.json(pending.map(serializeFriendRequest));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/friends/request
router.post('/request', async (req, res) => {
  try {
    const { toUserId } = req.body;
    if (!toUserId) return res.status(400).json({ error: 'toUserId required' });

    const fromUserId  = new mongoose.Types.ObjectId(req.user._id);
    const toUserObjId = new mongoose.Types.ObjectId(toUserId);

    const existing = await Friendship.findOne({
      $or: [
        { fromUserId, toUserId: toUserObjId },
        { fromUserId: toUserObjId, toUserId: fromUserId },
      ],
    });
    if (existing) return res.status(400).json({ error: 'Request already exists' });

    const [fromUser, toUser] = await Promise.all([
      User.findById(fromUserId),
      User.findById(toUserObjId),
    ]);
    if (!fromUser || !toUser) return res.status(404).json({ error: 'User not found' });

    const fs = await Friendship.create({
      fromUserId,
      fromUsername:    fromUser.username,
      fromDisplayName: fromUser.displayName,
      fromColor:       fromUser.color,
      fromEmoji:       fromUser.emoji,
      toUserId:        toUserObjId,
      toUsername:      toUser.username,
    });

    res.status(201).json(serializeFriendRequest(fs));
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Request already exists' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/friends/accept/:id
router.post('/accept/:id', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const fs = await Friendship.findOneAndUpdate(
      { _id: req.params.id, toUserId: userId, status: 'pending' },
      { status: 'accepted' },
      { new: true }
    );
    if (!fs) return res.status(404).json({ error: 'Request not found' });
    res.json(serializeFriendRequest(fs));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/friends/:otherUserId
// Removes the friendship in any state: cancel a sent request,
// decline an incoming one, or unfriend an accepted friend.
router.delete('/:otherUserId', async (req, res) => {
  try {
    const userId  = new mongoose.Types.ObjectId(req.user._id);
    const otherId = new mongoose.Types.ObjectId(req.params.otherUserId);
    const fs = await Friendship.findOneAndDelete({
      $or: [
        { fromUserId: userId, toUserId: otherId },
        { fromUserId: otherId, toUserId: userId },
      ],
    });
    if (!fs) return res.status(404).json({ error: 'Friendship not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
