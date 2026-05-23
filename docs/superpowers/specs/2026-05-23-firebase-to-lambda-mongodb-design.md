# Playdate App — Firebase → AWS Lambda + MongoDB Migration

**Date:** 2026-05-23  
**Status:** Approved  

---

## Goal

Migrate the Playdate app from Firebase (Firestore + Firebase Auth) to a stack that can be hosted on AWS Lambda (backend) and Vercel (frontend), with MongoDB Atlas as the database. Pattern copied directly from the HabitTracker reference implementation at `C:\Smit\HabitTracker`.

---

## Architecture

```
Browser → Vercel CDN (static React app)
         ↓ /api/* rewrite
         AWS API Gateway → Lambda (Express via @vendia/serverless-express) → MongoDB Atlas
```

**Repo structure (monorepo):**
```
playdate 2/
├── src/                        ← React frontend (Vercel)
├── server/                     ← Express backend (AWS SAM → Lambda)
│   ├── app.js
│   ├── lambda.js
│   ├── index.js                ← local dev only
│   ├── package.json
│   ├── template.yaml
│   ├── samconfig.toml
│   ├── middleware/
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Username.js
│   │   ├── Friendship.js
│   │   └── Playdate.js
│   └── routes/
│       ├── auth.js
│       ├── users.js
│       ├── friends.js
│       └── playdates.js
├── vercel.json
├── .env.example
└── package.json
```

---

## Auth

Google OAuth → JWT cookie (identical to HabitTracker):

1. Frontend loads Google One Tap (`accounts.google.com/gsi/client` script tag — no npm package).
2. User signs in → Google returns a `credential` token.
3. Frontend calls `POST /api/auth/verify` with the credential.
4. Backend verifies with `google-auth-library`, upserts User in MongoDB, signs a JWT, sets httpOnly cookie.
5. All subsequent API calls carry the cookie automatically (`credentials: 'include'`).
6. `requireAuth` middleware verifies JWT on every protected route.

Cookie config: `SameSite=None; Secure` in production (cross-site: Vercel domain ≠ API Gateway domain). Set via `COOKIE_SAME_SITE=none` env var in Lambda.

---

## Backend — Models

### User
```
googleId        String  required unique
email           String  required
username        String  unique sparse
displayName     String
color           String
emoji           String
parentModeEnabled Boolean default false
availability    Map<day, [HH:MM]>   day ∈ {mon,tue,wed,thu,fri,sat,sun}
```
Profile is incomplete until `username` is set (first-time setup flow).

### Username
```
username   String  required unique  (lowercase)
userId     ObjectId → User
```
Separate collection for O(1) username → userId lookup (mirrors Firestore `usernames` collection).

### Friendship
```
fromUserId   ObjectId → User
toUserId     ObjectId → User
status       enum: pending | accepted
createdAt    Date
```
Compound index: `(fromUserId, toUserId)` unique to prevent duplicates.

### Playdate
```
requesterId        ObjectId → User
recipientId        ObjectId → User
requesterName      String
requesterColor     String
requesterEmoji     String
recipientName      String
recipientColor     String
recipientEmoji     String
date               String   YYYY-MM-DD
timeSlot           String   HH:MM
type               enum: playdate | meeting
status             enum: pending | confirmed | declined
parentApprovalNeeded  Boolean
parentApproved     Boolean  default false
message            String
createdAt          Date
```
Snapshot fields (name/color/emoji) are denormalized at creation time — no joins needed on read.

---

## Backend — API Routes

All routes under `/api/`. Routes except `/api/auth/*` require `requireAuth` middleware.

### Auth
```
POST /api/auth/verify          body: { credential }  → sets JWT cookie, returns user
GET  /api/auth/me              → current user (from JWT)
POST /api/auth/logout          → clears cookie
```

### Users
```
GET  /api/users/me             → own full profile
POST /api/users/setup          → first-time setup: creates User + Username docs
                                 400 if username taken
PUT  /api/users/me             → update displayName/color/emoji/username/parentModeEnabled
                                 handles username rename (delete old Username doc, create new)
PUT  /api/users/me/availability  body: { day, slots }  → update one day's slots
GET  /api/users/search?u=      → find user by @username (returns public profile)
```

### Friends
```
GET  /api/friends              → accepted friends list with full profiles
GET  /api/friends/requests     → pending requests (incoming + outgoing)
POST /api/friends/request      body: { toUserId }
                                 400 if already exists
POST /api/friends/accept/:id   → sets status=accepted
```

### Playdates
```
GET  /api/playdates            → all playdates where user is requester or recipient
                                 sorted by createdAt desc
POST /api/playdates            body: { recipientId, date, timeSlot, type, message }
                                 snapshots names/colors/emojis at creation
POST /api/playdates/:id/confirm  → status=confirmed (recipient only)
POST /api/playdates/:id/decline  → status=declined (recipient only)
```

---

## Frontend Changes

### Remove
- `src/firebase.ts` — deleted
- `firebase` npm package

### Add
- `src/lib/api.ts` — `apiFetch(path, options)` wrapper with `credentials: 'include'`
- `src/context/AuthContext.tsx` — `useAuth()` hook: calls `/api/auth/me` on mount, exposes `user`, `loading`, `login(credential)`, `logout()`

### Modify
- `src/main.tsx` — wrap app with `<AuthProvider>`
- `src/screens/AuthScreen.tsx` — replace Firebase Google button with Google One Tap script; on credential callback call `AuthContext.login(credential)`
- `src/App.tsx` — remove all Firebase imports, `onSnapshot`, `onAuthStateChanged`; replace with `useEffect` + `apiFetch` fetches; manual refresh: each mutating action (accept friend, confirm playdate, etc.) re-fetches affected list after the POST
- `package.json` — remove `firebase` dependency

### Data loading pattern (manual refresh)
No real-time listeners. Each screen fetches its data on mount. After a mutation (send request, accept, confirm, decline), the handler re-fetches the relevant list. No polling, no background traffic.

---

## Environment Variables

### Frontend (Vite)
```
VITE_API_BASE_URL=       (empty in Vercel — rewrites handle routing; set to http://localhost:3001 for local dev)
VITE_GOOGLE_CLIENT_ID=xxx
```

### Backend (Lambda / local)
```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
GOOGLE_CLIENT_ID=...
ALLOWED_ORIGIN=https://your-app.vercel.app
NODE_ENV=production
COOKIE_SAME_SITE=none
```

---

## Deployment

### Backend (AWS SAM)
```bash
cd server
sam build
sam deploy --guided     # first time — saves samconfig.toml
sam deploy              # subsequent updates
```
SAM template parameters: `MongoDbUri`, `JwtSecret`, `GoogleClientId`, `AllowedOrigin` (all `NoEcho: true` except `AllowedOrigin`).

HttpApi CORS: `AllowCredentials: true`, `AllowHeaders: [Content-Type, Cookie]`, all methods.

### Frontend (Vercel)
- Framework preset: Vite
- Build command: `npm run build`
- Output: `dist`
- `vercel.json` rewrites `/api/:path*` → `https://<api-gateway-id>.execute-api.<region>.amazonaws.com/api/:path*`

### First-deploy sequence
1. Deploy backend → get API Gateway URL
2. Paste URL into `vercel.json`
3. Deploy frontend → get Vercel URL
4. Update Lambda `ALLOWED_ORIGIN` → Vercel URL → `sam deploy`

---

## Local Dev
```bash
# Terminal 1
cd server && node index.js        # Express on :3001

# Terminal 2
npm run dev                       # Vite on :5173
# VITE_API_BASE_URL=http://localhost:3001 in .env.local
```

---

## What Does NOT Change
- All React component files (`ColorPicker`, `EmojiPicker`, `AvailabilityGrid`, `PlaydateCard`, etc.)
- `src/types.ts`, `src/constants.ts`, `src/lib/suggestions.ts`
- Tailwind config, Vite config, TypeScript config
- All screen layouts and UI logic
