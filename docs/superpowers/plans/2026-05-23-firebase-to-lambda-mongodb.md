# Firebase → AWS Lambda + MongoDB Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Firebase/Firestore with an Express.js API on AWS Lambda backed by MongoDB Atlas, with the React frontend deployed to Vercel.

**Architecture:** Monorepo — `server/` folder holds the Express + SAM backend; frontend stays at the repo root. Vercel rewrites `/api/*` to the API Gateway URL. Auth uses Google One Tap → JWT httpOnly cookie, identical to the HabitTracker reference at `C:\Smit\HabitTracker`.

**Tech Stack:** Node.js 20 (CommonJS), Express 5, Mongoose 9, @vendia/serverless-express 4, AWS SAM, React 18 + TypeScript, Vite, Tailwind

**Reference implementation:** `C:\Smit\HabitTracker\server\` — copy patterns exactly.

---

## File Map

### Created (backend)
- `server/package.json`
- `server/app.js`
- `server/lambda.js`
- `server/index.js`
- `server/template.yaml`
- `server/samconfig.toml`
- `server/.env.example`
- `server/middleware/auth.js`
- `server/middleware/errorHandler.js`
- `server/models/User.js`
- `server/models/Username.js`
- `server/models/Friendship.js`
- `server/models/Playdate.js`
- `server/routes/auth.js`
- `server/routes/users.js`
- `server/routes/friends.js`
- `server/routes/playdates.js`

### Created (frontend)
- `src/lib/api.ts`
- `src/context/AuthContext.tsx`
- `vercel.json`
- `.env.example`

### Modified (frontend)
- `src/main.tsx` — wrap with `<AuthProvider>`
- `src/screens/AuthScreen.tsx` — replace Firebase Google button with Google One Tap
- `src/App.tsx` — remove all Firebase imports; use `apiFetch` + `useAuth`
- `package.json` — remove `firebase` dependency

### Deleted
- `src/firebase.ts`

---

## Task 1: Server package.json + scaffold files

**Files:**
- Create: `server/package.json`
- Create: `server/app.js`
- Create: `server/lambda.js`
- Create: `server/index.js`

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "playdate-server",
  "version": "1.0.0",
  "main": "index.js",
  "type": "commonjs",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "build": "sam build",
    "deploy": "sam deploy --guided",
    "deploy:update": "sam build && sam deploy"
  },
  "dependencies": {
    "@vendia/serverless-express": "^4.12.6",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "google-auth-library": "^10.6.2",
    "helmet": "^8.1.0",
    "jsonwebtoken": "^9.0.3",
    "mongoose": "^9.6.2",
    "morgan": "^1.10.1"
  },
  "devDependencies": {
    "nodemon": "^3.1.14"
  }
}
```

- [ ] **Step 2: Create `server/app.js`**

```js
require('dotenv').config();

const REQUIRED = ['MONGODB_URI', 'JWT_SECRET', 'GOOGLE_CLIENT_ID', 'ALLOWED_ORIGIN'];
const missing  = REQUIRED.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const helmet       = require('helmet');
const morgan       = require('morgan');

const requireAuth    = require('./middleware/auth');
const errorHandler   = require('./middleware/errorHandler');
const authRouter     = require('./routes/auth');
const usersRouter    = require('./routes/users');
const friendsRouter  = require('./routes/friends');
const playdatesRouter = require('./routes/playdates');

const app    = express();
const isProd = process.env.NODE_ENV === 'production';

app.use(helmet());
app.use(morgan(isProd ? 'combined' : 'dev'));
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN,
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.use('/api/auth',      authRouter);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/users',     requireAuth, usersRouter);
app.use('/api/friends',   requireAuth, friendsRouter);
app.use('/api/playdates', requireAuth, playdatesRouter);

app.use(errorHandler);

module.exports = app;
```

- [ ] **Step 3: Create `server/lambda.js`**

```js
const serverlessExpress = require('@vendia/serverless-express');
const mongoose          = require('mongoose');
const app               = require('./app');

let cachedHandler = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await connectDB();
  if (!cachedHandler) cachedHandler = serverlessExpress({ app });
  return cachedHandler(event, context);
};
```

- [ ] **Step 4: Create `server/index.js`** (local dev only)

```js
const mongoose = require('mongoose');
const app      = require('./app');

const PORT = process.env.PORT || 3001;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    const server = app.listen(PORT, () =>
      console.log(`Server running on http://localhost:${PORT}`)
    );
    const shutdown = () => server.close(() => { mongoose.connection.close(); process.exit(0); });
    process.on('SIGTERM', shutdown);
    process.on('SIGINT',  shutdown);
  })
  .catch(err => { console.error('MongoDB connection error:', err.message); process.exit(1); });
```

- [ ] **Step 5: Install server dependencies**

```bash
cd server
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Commit**

```bash
git add server/package.json server/app.js server/lambda.js server/index.js server/package-lock.json
git commit -m "feat: add server scaffold (Express + Lambda entry points)"
```

---

## Task 2: SAM template + env files

**Files:**
- Create: `server/template.yaml`
- Create: `server/samconfig.toml`
- Create: `server/.env.example`

- [ ] **Step 1: Create `server/template.yaml`**

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Description: PlayDate API

Globals:
  Function:
    Runtime: nodejs20.x
    Timeout: 15
    MemorySize: 256
    Environment:
      Variables:
        NODE_ENV: production
        MONGODB_URI: !Ref MongoDbUri
        JWT_SECRET: !Ref JwtSecret
        GOOGLE_CLIENT_ID: !Ref GoogleClientId
        ALLOWED_ORIGIN: !Ref AllowedOrigin
        COOKIE_SAME_SITE: none

Parameters:
  MongoDbUri:
    Type: String
    NoEcho: true
  JwtSecret:
    Type: String
    NoEcho: true
  GoogleClientId:
    Type: String
  AllowedOrigin:
    Type: String

Resources:
  PlayDateFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: lambda.handler
      CodeUri: .
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref PlayDateApi

  PlayDateApi:
    Type: AWS::Serverless::HttpApi
    Properties:
      CorsConfiguration:
        AllowOrigins:
          - !Ref AllowedOrigin
        AllowHeaders:
          - Content-Type
          - Cookie
        AllowMethods:
          - GET
          - POST
          - PUT
          - DELETE
          - OPTIONS
        AllowCredentials: true
        MaxAge: 300

Outputs:
  ApiUrl:
    Description: API Gateway endpoint URL
    Value: !Sub 'https://${PlayDateApi}.execute-api.${AWS::Region}.amazonaws.com'
```

- [ ] **Step 2: Create `server/samconfig.toml`**

```toml
version = 0.1

[default.global.parameters]
stack_name = "playdate-api"
region = "us-east-2"

[default.build.parameters]
cached = true
parallel = true

[default.deploy.parameters]
capabilities = "CAPABILITY_IAM"
confirm_changeset = true
resolve_s3 = true
region = "us-east-2"
s3_prefix = "playdate-api"
parameter_overrides = "AllowedOrigin=\"http://localhost:5173\""
image_repositories = []
```

- [ ] **Step 3: Create `server/.env.example`**

```
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/playdate?retryWrites=true&w=majority
JWT_SECRET=change-me-to-a-long-random-string
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
ALLOWED_ORIGIN=http://localhost:5173
NODE_ENV=development
COOKIE_SAME_SITE=lax
PORT=3001
```

- [ ] **Step 4: Copy your actual `.env` values into `server/.env`**

The user already has `MONGODB_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `ALLOWED_ORIGIN` ready.
Create `server/.env` with those values plus:
```
NODE_ENV=development
COOKIE_SAME_SITE=lax
PORT=3001
```

Verify `server/.env` is in `.gitignore` (root `.gitignore` already has `.env` entries from the Firebase project).

- [ ] **Step 5: Commit**

```bash
git add server/template.yaml server/samconfig.toml server/.env.example
git commit -m "feat: add SAM template and env config"
```

---

## Task 3: Middleware

**Files:**
- Create: `server/middleware/auth.js`
- Create: `server/middleware/errorHandler.js`

- [ ] **Step 1: Create `server/middleware/auth.js`**

```js
const jwt = require('jsonwebtoken');

module.exports = function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.clearCookie('token');
    res.status(401).json({ error: 'Session expired' });
  }
};
```

- [ ] **Step 2: Create `server/middleware/errorHandler.js`**

```js
const isProd = process.env.NODE_ENV === 'production';

module.exports = function errorHandler(err, _req, res, _next) {
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: isProd && status === 500 ? 'Internal server error' : err.message,
  });
};
```

- [ ] **Step 3: Commit**

```bash
git add server/middleware/
git commit -m "feat: add auth and error handler middleware"
```

---

## Task 4: Mongoose models

**Files:**
- Create: `server/models/User.js`
- Create: `server/models/Username.js`
- Create: `server/models/Friendship.js`
- Create: `server/models/Playdate.js`

- [ ] **Step 1: Create `server/models/User.js`**

```js
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
```

- [ ] **Step 2: Create `server/models/Username.js`**

```js
const mongoose = require('mongoose');

const usernameSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

module.exports = mongoose.model('Username', usernameSchema);
```

- [ ] **Step 3: Create `server/models/Friendship.js`**

Stores snapshot display fields at creation time so reads never need joins.

```js
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
```

- [ ] **Step 4: Create `server/models/Playdate.js`**

```js
const mongoose = require('mongoose');

const playdateSchema = new mongoose.Schema({
  requesterId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipientId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requesterName:         { type: String, required: true },
  requesterColor:        { type: String, required: true },
  requesterEmoji:        { type: String, required: true },
  recipientName:         { type: String, required: true },
  recipientColor:        { type: String, required: true },
  recipientEmoji:        { type: String, required: true },
  date:                  { type: String, required: true },
  timeSlot:              { type: String, required: true },
  type:                  { type: String, enum: ['playdate', 'meeting'], required: true },
  status:                { type: String, enum: ['pending', 'confirmed', 'declined'], default: 'pending' },
  parentApprovalNeeded:  { type: Boolean, default: false },
  parentApproved:        { type: Boolean, default: false },
  message:               { type: String, default: '' },
  createdAt:             { type: Date, default: Date.now },
});

module.exports = mongoose.model('Playdate', playdateSchema);
```

- [ ] **Step 5: Commit**

```bash
git add server/models/
git commit -m "feat: add Mongoose models (User, Username, Friendship, Playdate)"
```

---

## Task 5: Auth routes

**Files:**
- Create: `server/routes/auth.js`

- [ ] **Step 1: Create `server/routes/auth.js`**

```js
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

// POST /api/auth/verify — receives Google credential from frontend
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

// GET /api/auth/me — returns current user from JWT cookie
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
```

- [ ] **Step 2: Verify server starts without errors**

```bash
cd server
node -e "require('./app'); console.log('app loaded ok')"
```

Expected: `app loaded ok` (will print env-var warning and exit if .env not present — make sure server/.env exists).

- [ ] **Step 3: Commit**

```bash
git add server/routes/auth.js
git commit -m "feat: add auth routes (Google verify, /me, logout)"
```

---

## Task 6: Users routes

**Files:**
- Create: `server/routes/users.js`

- [ ] **Step 1: Create `server/routes/users.js`**

```js
const express    = require('express');
const router     = express.Router();
const User       = require('../models/User');
const Username   = require('../models/Username');

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

// POST /api/users/setup — first-time profile creation
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

// PUT /api/users/me — update display fields (and optionally username)
router.put('/me', async (req, res) => {
  try {
    const { username, displayName, color, emoji, parentModeEnabled } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updates = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (color       !== undefined) updates.color = color;
    if (emoji       !== undefined) updates.emoji = emoji;
    if (parentModeEnabled !== undefined) updates.parentModeEnabled = !!parentModeEnabled;

    if (username !== undefined && username !== user.username) {
      const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (clean.length < 3) return res.status(400).json({ error: 'Username too short' });

      const existing = await Username.findOne({ username: clean });
      if (existing && existing.userId.toString() !== req.user._id) {
        return res.status(400).json({ error: `@${clean} is taken! Try a different one.` });
      }

      // Remove old, create new
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

// PUT /api/users/me/availability — update one day's slots
router.put('/me/availability', async (req, res) => {
  try {
    const { day, slots } = req.body;
    const validDays = ['mon','tue','wed','thu','fri','sat','sun'];
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
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/users.js
git commit -m "feat: add users routes (setup, profile, availability, search)"
```

---

## Task 7: Friends routes

**Files:**
- Create: `server/routes/friends.js`

- [ ] **Step 1: Create `server/routes/friends.js`**

```js
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

// GET /api/friends — accepted friends with current profiles
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

    const users = await User.find({ _id: { $in: friendIds }, username: { $exists: true, $ne: null } });
    res.json(users.map(serializeFriend));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/friends/requests — pending requests (both directions)
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

// POST /api/friends/request — body: { toUserId }
router.post('/request', async (req, res) => {
  try {
    const { toUserId } = req.body;
    if (!toUserId) return res.status(400).json({ error: 'toUserId required' });

    const fromUserId = new mongoose.Types.ObjectId(req.user._id);
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

module.exports = router;
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/friends.js
git commit -m "feat: add friends routes (list, requests, send, accept)"
```

---

## Task 8: Playdates routes

**Files:**
- Create: `server/routes/playdates.js`

- [ ] **Step 1: Create `server/routes/playdates.js`**

```js
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

// GET /api/playdates — all playdates where current user is requester or recipient
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

// POST /api/playdates — create a playdate request
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

// POST /api/playdates/:id/confirm — recipient only
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

// POST /api/playdates/:id/decline — recipient only
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
```

- [ ] **Step 2: Start server and smoke-test health endpoint**

```bash
cd server
node index.js
# In another terminal:
curl http://localhost:3001/api/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 3: Commit**

```bash
git add server/routes/playdates.js
git commit -m "feat: add playdates routes (list, create, confirm, decline)"
```

---

## Task 9: Frontend — api.ts + AuthContext

**Files:**
- Create: `src/lib/api.ts`
- Create: `src/context/AuthContext.tsx`

- [ ] **Step 1: Create `src/lib/api.ts`**

```ts
const BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }
  return res.json() as Promise<T>;
}
```

- [ ] **Step 2: Create `src/context/AuthContext.tsx`**

`authUser` is the object returned by `/api/auth/me`: it always has `uid` + `email`, and additionally has `username` etc. if setup is complete.

```tsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';

export interface AuthUser {
  uid: string;
  email: string;
  username?: string;
  displayName?: string;
  color?: string;
  emoji?: string;
  parentModeEnabled?: boolean;
  availability?: Record<string, string[]>;
}

interface AuthContextValue {
  authUser: AuthUser | null;
  loading: boolean;
  login: (googleCredential: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading]   = useState(true);

  const refreshAuth = useCallback(async () => {
    try {
      const u = await apiFetch<AuthUser>('/api/auth/me');
      setAuthUser(u);
    } catch {
      setAuthUser(null);
    }
  }, []);

  useEffect(() => {
    refreshAuth().finally(() => setLoading(false));
  }, [refreshAuth]);

  const login = useCallback(async (googleCredential: string) => {
    const u = await apiFetch<AuthUser>('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ credential: googleCredential }),
    });
    setAuthUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setAuthUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ authUser, loading, login, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts src/context/AuthContext.tsx
git commit -m "feat: add api fetch helper and AuthContext"
```

---

## Task 10: Replace AuthScreen

**Files:**
- Modify: `src/screens/AuthScreen.tsx`

Replace the entire file. The new version drops email/password auth (not needed — Google-only) and uses Google One Tap via a `<script>` tag + a `data-callback` handler attached to `window`.

- [ ] **Step 1: Replace `src/screens/AuthScreen.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

declare global {
  interface Window {
    handleGoogleCredential: (response: { credential: string }) => void;
    google?: {
      accounts: {
        id: {
          initialize: (opts: object) => void;
          renderButton: (el: HTMLElement, opts: object) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export default function AuthScreen() {
  const { login } = useAuth();
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    window.handleGoogleCredential = async ({ credential }) => {
      setError('');
      setLoading(true);
      try {
        await login(credential);
      } catch {
        setError('Sign-in failed. Try again!');
        setLoading(false);
      }
    };

    const script = document.createElement('script');
    script.src   = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback:  'handleGoogleCredential',
      });
      const btn = document.getElementById('google-btn');
      if (btn) {
        window.google?.accounts.id.renderButton(btn, {
          theme: 'outline',
          size:  'large',
          width: 340,
        });
      }
      window.google?.accounts.id.prompt();
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
      delete window.handleGoogleCredential;
    };
  }, [login]);

  return (
    <div className="min-h-screen bg-[#FFF8F0] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-7xl mb-3">🎉</div>
          <h1 className="text-4xl font-black text-gray-800">PlayDate</h1>
          <p className="text-gray-500 font-semibold mt-1">Schedule fun with your friends!</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm text-center">
          <p className="font-black text-gray-700 mb-5">Sign in to get started</p>

          {loading ? (
            <div className="text-4xl animate-bounce">⏳</div>
          ) : (
            <div id="google-btn" className="flex justify-center" />
          )}

          {error && (
            <p className="text-red-500 font-bold text-sm mt-4">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/AuthScreen.tsx
git commit -m "feat: replace Firebase auth with Google One Tap"
```

---

## Task 11: Replace App.tsx

**Files:**
- Modify: `src/App.tsx`

Replace the entire file. Remove all Firebase imports. Use `useAuth()` + `apiFetch` calls. Manual refresh: each mutating action re-fetches the affected list after the POST.

- [ ] **Step 1: Replace `src/App.tsx`**

```tsx
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { apiFetch } from './lib/api';
import type { Day, Friend, FriendRequest, Playdate, Screen, UserProfile } from './types';
import AuthScreen from './screens/AuthScreen';
import Layout from './components/Layout';
import SetupScreen from './screens/SetupScreen';
import HomeScreen from './screens/HomeScreen';
import AvailabilityScreen from './screens/AvailabilityScreen';
import FriendsScreen from './screens/FriendsScreen';
import RequestsScreen from './screens/RequestsScreen';
import RequestPlaydateModal from './components/RequestPlaydateModal';
import ProfileEditModal from './components/ProfileEditModal';

export default function App() {
  const { authUser, loading: authLoading, logout, refreshAuth } = useAuth();

  const [currentUser, setCurrentUser]     = useState<UserProfile | null>(null);
  const [screen, setScreen]               = useState<Screen>('home');
  const [friends, setFriends]             = useState<Friend[]>([]);
  const [playdates, setPlaydates]         = useState<Playdate[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [requestModal, setRequestModal]   = useState<{ friend: Friend; prefill?: { date: string; timeSlot: string } } | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [dataLoading, setDataLoading]     = useState(false);

  // When authUser has a profile (username set), load app data
  useEffect(() => {
    if (!authUser?.username) {
      setCurrentUser(null);
      setFriends([]);
      setPlaydates([]);
      setFriendRequests([]);
      return;
    }

    setCurrentUser({
      uid:               authUser.uid,
      username:          authUser.username,
      displayName:       authUser.displayName ?? '',
      color:             authUser.color ?? '#4D96FF',
      emoji:             authUser.emoji ?? '🦁',
      parentModeEnabled: authUser.parentModeEnabled ?? false,
      availability:      (authUser.availability ?? {}) as Partial<Record<Day, string[]>>,
    });

    setDataLoading(true);
    Promise.all([
      apiFetch<Friend[]>('/api/friends'),
      apiFetch<Playdate[]>('/api/playdates'),
      apiFetch<FriendRequest[]>('/api/friends/requests'),
    ])
      .then(([f, p, fr]) => {
        setFriends(f);
        setPlaydates(p);
        setFriendRequests(fr);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));
  }, [authUser]);

  const refreshFriends = useCallback(async () => {
    const [f, fr] = await Promise.all([
      apiFetch<Friend[]>('/api/friends'),
      apiFetch<FriendRequest[]>('/api/friends/requests'),
    ]);
    setFriends(f);
    setFriendRequests(fr);
  }, []);

  const refreshPlaydates = useCallback(async () => {
    const p = await apiFetch<Playdate[]>('/api/playdates');
    setPlaydates(p);
  }, []);

  const handleSetupComplete = useCallback(
    async (profile: Omit<UserProfile, 'uid'>) => {
      await apiFetch('/api/users/setup', {
        method: 'POST',
        body: JSON.stringify(profile),
      });
      await refreshAuth();
    },
    [refreshAuth]
  );

  const handleUpdateProfile = useCallback(
    async (updates: Partial<Omit<UserProfile, 'uid' | 'availability'>>) => {
      const updated = await apiFetch<UserProfile>('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      setCurrentUser(updated);
      await refreshAuth();
    },
    [refreshAuth]
  );

  const handleSaveAvailability = useCallback(
    async (day: Day, slots: string[]) => {
      if (!currentUser) return;
      const updated: Partial<Record<Day, string[]>> = { ...currentUser.availability, [day]: slots };
      setCurrentUser((prev) => prev && { ...prev, availability: updated });
      await apiFetch('/api/users/me/availability', {
        method: 'PUT',
        body: JSON.stringify({ day, slots }),
      });
    },
    [currentUser]
  );

  const handleSearch = useCallback(async (username: string): Promise<UserProfile | null> => {
    try {
      return await apiFetch<UserProfile>(`/api/users/search?u=${encodeURIComponent(username)}`);
    } catch {
      return null;
    }
  }, []);

  const handleSendFriendRequest = useCallback(
    async (toUser: UserProfile) => {
      await apiFetch('/api/friends/request', {
        method: 'POST',
        body: JSON.stringify({ toUserId: toUser.uid }),
      });
      await refreshFriends();
    },
    [refreshFriends]
  );

  const handleAcceptFriendRequest = useCallback(
    async (request: FriendRequest) => {
      await apiFetch(`/api/friends/accept/${request.id}`, { method: 'POST' });
      await refreshFriends();
    },
    [refreshFriends]
  );

  const handleSendPlaydateRequest = useCallback(
    async (data: { type: 'playdate' | 'meeting'; date: string; timeSlot: string; message: string }) => {
      if (!requestModal) return;
      await apiFetch('/api/playdates', {
        method: 'POST',
        body: JSON.stringify({ recipientId: requestModal.friend.uid, ...data }),
      });
      setRequestModal(null);
      await refreshPlaydates();
    },
    [requestModal, refreshPlaydates]
  );

  const handleConfirmPlaydate = useCallback(
    async (id: string) => {
      await apiFetch(`/api/playdates/${id}/confirm`, { method: 'POST' });
      await refreshPlaydates();
    },
    [refreshPlaydates]
  );

  const handleDeclinePlaydate = useCallback(
    async (id: string) => {
      await apiFetch(`/api/playdates/${id}/decline`, { method: 'POST' });
      await refreshPlaydates();
    },
    [refreshPlaydates]
  );

  const handleSignOut = useCallback(async () => {
    await logout();
    setEditProfileOpen(false);
    setCurrentUser(null);
  }, [logout]);

  const pendingIncoming = playdates.filter(
    (p) => p.recipientId === authUser?.uid && p.status === 'pending'
  ).length;

  const incomingFriendReqs = friendRequests.filter(
    (r) => r.toUid === authUser?.uid && r.status === 'pending'
  );

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFF8F0]">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🎉</div>
          <p className="font-black text-gray-500 text-xl">Loading PlayDate...</p>
        </div>
      </div>
    );
  }

  if (!authUser) return <AuthScreen />;

  if (!authUser.username || !currentUser) {
    return <SetupScreen onComplete={handleSetupComplete} />;
  }

  const screenProps = { currentUser, navigate: setScreen };

  return (
    <>
      <Layout
        currentUser={currentUser}
        screen={screen}
        navigate={setScreen}
        badgeCount={pendingIncoming}
        friendsBadgeCount={incomingFriendReqs.length}
        onEditProfile={() => setEditProfileOpen(true)}
      >
        {screen === 'home' && (
          <HomeScreen
            {...screenProps}
            friends={friends}
            playdates={playdates}
            onRequestPlaydate={(friend, prefill) => setRequestModal({ friend, prefill })}
          />
        )}
        {screen === 'availability' && (
          <AvailabilityScreen {...screenProps} onSaveDay={handleSaveAvailability} />
        )}
        {screen === 'friends' && (
          <FriendsScreen
            {...screenProps}
            friends={friends}
            pendingRequests={friendRequests}
            onSearch={handleSearch}
            onSendFriendRequest={handleSendFriendRequest}
            onAcceptFriendRequest={handleAcceptFriendRequest}
            onRequestPlaydate={(friend) => setRequestModal({ friend })}
          />
        )}
        {screen === 'requests' && (
          <RequestsScreen
            {...screenProps}
            playdates={playdates}
            onConfirm={handleConfirmPlaydate}
            onDecline={handleDeclinePlaydate}
          />
        )}
      </Layout>

      {requestModal && (
        <RequestPlaydateModal
          friend={requestModal.friend}
          currentUser={currentUser}
          prefill={requestModal.prefill}
          onSubmit={handleSendPlaydateRequest}
          onClose={() => setRequestModal(null)}
        />
      )}

      {editProfileOpen && (
        <ProfileEditModal
          currentUser={currentUser}
          onSave={handleUpdateProfile}
          onClose={() => setEditProfileOpen(false)}
          onSignOut={handleSignOut}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat: replace Firebase with REST API in App.tsx"
```

---

## Task 12: Wrap main.tsx with AuthProvider

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Update `src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
```

- [ ] **Step 2: Commit**

```bash
git add src/main.tsx
git commit -m "feat: wrap app with AuthProvider"
```

---

## Task 13: Cleanup — remove Firebase, add vercel.json + env files

**Files:**
- Delete: `src/firebase.ts`
- Modify: `package.json`
- Create: `vercel.json`
- Create: `.env.example`
- Create: `.env.local` (local dev only, gitignored)

- [ ] **Step 1: Delete `src/firebase.ts`**

```bash
git rm src/firebase.ts
```

- [ ] **Step 2: Remove firebase from `package.json`**

Open `package.json`. Remove the `"firebase": "^10.7.0"` line from `dependencies`. Then:

```bash
npm uninstall firebase
```

Expected: `package.json` and `package-lock.json` updated.

- [ ] **Step 3: Create `vercel.json`**

Replace `<YOUR_API_GATEWAY_URL>` after the first SAM deploy.

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "<YOUR_API_GATEWAY_URL>/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

> Note: For local dev you do NOT use vercel.json. Set `VITE_API_BASE_URL=http://localhost:3001` in `.env.local` instead.

- [ ] **Step 4: Create root `.env.example`**

```
VITE_API_BASE_URL=
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

- [ ] **Step 5: Create `.env.local` for local dev (gitignored)**

```
VITE_API_BASE_URL=http://localhost:3001
VITE_GOOGLE_CLIENT_ID=<same client ID as server>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. If there are errors around missing Firebase imports in other files (unlikely — firebase.ts was only imported in App.tsx), fix them.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vercel.json .env.example
git commit -m "feat: remove Firebase, add vercel.json and env example"
```

---

## Task 14: Local integration test

- [ ] **Step 1: Start backend**

```bash
cd server
node index.js
```

Expected output:
```
Connected to MongoDB
Server running on http://localhost:3001
```

- [ ] **Step 2: Smoke-test backend**

```bash
curl http://localhost:3001/api/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 3: Start frontend**

```bash
# root of repo
npm run dev
```

Expected: Vite starts on `http://localhost:5173`

- [ ] **Step 4: Test auth flow in browser**

Open `http://localhost:5173`. Expect:
- Google One Tap prompt appears or Google Sign-In button renders
- Sign in with Google → redirected to SetupScreen (first time) or HomeScreen (if profile exists)

- [ ] **Step 5: Test setup flow**

On SetupScreen, complete name → color/emoji → username steps. Click "Let's Go!". Expected: profile saved, HomeScreen appears.

- [ ] **Step 6: Test friends flow**

Navigate to Friends. Search for a second test user by @username. Send request. In second browser/incognito, sign in as that user, accept. Both should see each other in friends list.

- [ ] **Step 7: Test playdate flow**

From HomeScreen or Friends, send a playdate request. In recipient account, navigate to Requests, confirm. Both accounts should see confirmed playdate.

---

## Task 15: Deploy to AWS Lambda

- [ ] **Step 1: Build and deploy**

```bash
cd server
sam build
sam deploy --guided
```

Answer the prompts:
- Stack name: `playdate-api`
- Region: `us-east-2`
- `MongoDbUri`: paste from your `.env`
- `JwtSecret`: paste from your `.env`
- `GoogleClientId`: paste from your `.env`
- `AllowedOrigin`: `https://<your-vercel-app>.vercel.app` (use `*` temporarily if Vercel URL not known yet)

- [ ] **Step 2: Note the API Gateway URL from SAM output**

```
Outputs
-------
ApiUrl: https://xxxxxxxxxx.execute-api.us-east-2.amazonaws.com
```

- [ ] **Step 3: Update `vercel.json` with the real API Gateway URL**

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://xxxxxxxxxx.execute-api.us-east-2.amazonaws.com/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

```bash
git add vercel.json
git commit -m "config: set API Gateway URL in vercel.json"
```

---

## Task 16: Deploy frontend to Vercel

- [ ] **Step 1: Deploy to Vercel**

```bash
npx vercel --prod
```

Or push to GitHub and connect repo in Vercel dashboard.

- [ ] **Step 2: Set environment variables in Vercel dashboard**

In Vercel project settings → Environment Variables:
```
VITE_API_BASE_URL=        (leave empty — vercel.json rewrites handle routing)
VITE_GOOGLE_CLIENT_ID=    <your client ID>
```

- [ ] **Step 3: Get Vercel deployment URL**

Example: `https://playdate-xyz.vercel.app`

- [ ] **Step 4: Update Lambda ALLOWED_ORIGIN**

```bash
cd server
sam deploy --parameter-overrides \
  "AllowedOrigin=https://playdate-xyz.vercel.app" \
  "GoogleClientId=<your-client-id>"
```

Or re-run `sam deploy` and update the parameter override.

- [ ] **Step 5: Add Vercel URL to Google OAuth authorized origins**

In Google Cloud Console → APIs & Services → Credentials → your OAuth client:
- Authorized JavaScript origins: add `https://playdate-xyz.vercel.app`
- Authorized redirect URIs: add `https://playdate-xyz.vercel.app`

- [ ] **Step 6: Smoke-test production**

Open `https://playdate-xyz.vercel.app`. Sign in with Google. Complete setup. Test a friend request end-to-end.

---

## Spec Coverage Check

| Spec requirement | Task |
|---|---|
| Monorepo with server/ | Task 1 |
| SAM template, samconfig.toml | Task 2 |
| JWT cookie auth (Google OAuth) | Tasks 3, 5 |
| User + Username models | Task 4 |
| Friendship + Playdate models | Task 4 |
| Auth routes (/verify, /me, /logout) | Task 5 |
| Users routes (setup, me, availability, search) | Task 6 |
| Friends routes (list, requests, request, accept) | Task 7 |
| Playdates routes (list, create, confirm, decline) | Task 8 |
| Frontend api.ts + AuthContext | Task 9 |
| AuthScreen → Google One Tap | Task 10 |
| App.tsx → REST API, manual refresh | Task 11 |
| AuthProvider in main.tsx | Task 12 |
| Remove Firebase, add vercel.json | Task 13 |
| Local integration test | Task 14 |
| Lambda deploy | Task 15 |
| Vercel deploy + CORS wiring | Task 16 |
| COOKIE_SAME_SITE=none for cross-site cookies | Task 2, template.yaml |
| Username rename (delete old, create new) | Task 6 |
