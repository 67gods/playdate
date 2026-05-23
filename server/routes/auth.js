const express          = require('express');
const router           = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt              = require('jsonwebtoken');
const User             = require('../models/User');
const requireAuth      = require('../middleware/auth');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.COOKIE_SAME_SITE === 'none' || process.env.NODE_ENV === 'production',
  sameSite: process.env.COOKIE_SAME_SITE || 'lax',
  maxAge:   7 * 24 * 60 * 60 * 1000,
};

function serializeUser(user) {
  const base = { uid: user._id.toString(), email: user.email };
  if (!user.username) return base;
  return {
    ...base,
    username:          user.username,
    displayName:       user.displayName,
    color:             user.color,
    emoji:             user.emoji,
    parentModeEnabled: user.parentModeEnabled,
    availability:      Object.fromEntries(user.availability || new Map()),
  };
}

// POST /api/auth/verify
router.post('/verify', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'credential required' });

    const ticket = await client.verifyIdToken({
      idToken:  credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { sub: googleId, email } = ticket.getPayload();

    const user = await User.findOneAndUpdate(
      { googleId },
      { email },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const token = jwt.sign(
      { _id: user._id.toString(), email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, COOKIE_OPTS).json(serializeUser(user));
  } catch {
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(serializeUser(user));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax' }).json({ message: 'Logged out' });
});

module.exports = router;
