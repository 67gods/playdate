const express  = require('express');
const router   = express.Router();
const User     = require('../models/User');
const Username = require('../models/Username');

function serializeProfile(user) {
  return {
    uid:               user._id.toString(),
    username:          user.username,
    displayName:       user.displayName,
    color:             user.color,
    emoji:             user.emoji,
    parentModeEnabled: user.parentModeEnabled,
    availability:      Object.fromEntries(user.availability || new Map()),
  };
}

// GET /api/users/me
router.get('/me', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || !user.username) return res.status(404).json({ error: 'Profile not found' });
    res.json(serializeProfile(user));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users/setup
router.post('/setup', async (req, res) => {
  try {
    const { username, displayName, color, emoji, parentModeEnabled } = req.body;
    if (!username || !displayName || !color || !emoji) {
      return res.status(400).json({ error: 'username, displayName, color, emoji required' });
    }
    const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (clean.length < 3) return res.status(400).json({ error: 'Username too short' });

    const existing = await Username.findOne({ username: clean });
    if (existing && existing.userId.toString() !== req.user._id) {
      return res.status(400).json({ error: `@${clean} is taken! Try a different one.` });
    }

    await Username.findOneAndUpdate(
      { userId: req.user._id },
      { username: clean, userId: req.user._id },
      { upsert: true }
    );

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { username: clean, displayName, color, emoji, parentModeEnabled: !!parentModeEnabled },
      { new: true }
    );

    res.json(serializeProfile(user));
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Username already taken' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/me
router.put('/me', async (req, res) => {
  try {
    const { username, displayName, color, emoji, parentModeEnabled } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updates = {};
    if (displayName       !== undefined) updates.displayName = displayName;
    if (color             !== undefined) updates.color = color;
    if (emoji             !== undefined) updates.emoji = emoji;
    if (parentModeEnabled !== undefined) updates.parentModeEnabled = !!parentModeEnabled;

    if (username !== undefined && username !== user.username) {
      const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (clean.length < 3) return res.status(400).json({ error: 'Username too short' });

      const existing = await Username.findOne({ username: clean });
      if (existing && existing.userId.toString() !== req.user._id) {
        return res.status(400).json({ error: `@${clean} is taken! Try a different one.` });
      }

      await Username.deleteOne({ userId: req.user._id });
      await Username.create({ username: clean, userId: req.user._id });
      updates.username = clean;
    }

    const updated = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json(serializeProfile(updated));
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Username already taken' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/me/availability
router.put('/me/availability', async (req, res) => {
  try {
    const { day, slots } = req.body;
    const validDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    if (!validDays.includes(day) || !Array.isArray(slots)) {
      return res.status(400).json({ error: 'day and slots required' });
    }
    const user = await User.findById(req.user._id);
    user.availability.set(day, slots);
    await user.save();
    res.json(serializeProfile(user));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/search?u=username
router.get('/search', async (req, res) => {
  try {
    const { u } = req.query;
    if (!u) return res.status(400).json({ error: 'u query param required' });
    const usernameDoc = await Username.findOne({ username: u.toLowerCase() });
    if (!usernameDoc) return res.status(404).json({ error: 'Not found' });
    const user = await User.findById(usernameDoc.userId);
    if (!user || !user.username) return res.status(404).json({ error: 'Not found' });
    res.json(serializeProfile(user));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
