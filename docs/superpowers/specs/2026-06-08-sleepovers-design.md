# Sleepovers — Design Spec

**Date:** 2026-06-08

## Context

The app lets kids schedule **playdates** and **meetings** between friends (request →
accept/decline flow). Users want a distinct **sleepover** feature: an overnight stay at one
friend's house, with a **drop-off time** (evening) and a **pick-up time** (next morning), the
ability to choose **whose house** it's at, and the ability to **cancel**. Sleepovers get their
own page (5th bottom-nav tab), separate from playdate Requests.

Sleepovers structurally resemble `Playdate` but differ enough (two clock times instead of a
slot array, a host, a cancel state) to warrant their own model, route, screen, and modal —
mirroring the existing playdate code rather than overloading it.

## Requirements

- A sleepover is between two friends: a **requester** and a **recipient**.
- Fields: a single **date** (the night), a **drop-off time**, a **pick-up time** (understood as
  the morning after), and a **host** (which of the two friends' houses).
- **Drop-off and pick-up times are both required** — a sleepover can never exist without both.
- Host is chosen via a **"My house" / "Their house"** toggle.
- Flow mirrors playdates: creating sends a **pending** request; recipient **Accepts** (→
  confirmed) or **Declines** (→ declined).
- **Either friend can cancel at any time** while the sleepover is live (pending or confirmed) →
  status `cancelled`. Cancel is the new capability unique to sleepovers.
- Parent-approval parity with playdates (`parentApprovalNeeded` / `parentApproved`), set from the
  requester's `parentModeEnabled`.

## Data Model — `server/models/Sleepover.js`

Mirror `Playdate.js`'s denormalized snapshot fields (requester/recipient name+color+emoji so
cards render without joins), replacing `timeSlots`/`type` with sleepover-specific fields:

```js
const sleepoverSchema = new mongoose.Schema({
  requesterId:    { type: ObjectId, ref: 'User', required: true },
  recipientId:    { type: ObjectId, ref: 'User', required: true },
  requesterName, requesterColor, requesterEmoji,   // String, required
  recipientName, recipientColor, recipientEmoji,   // String, required
  date:           { type: String, required: true },              // YYYY-MM-DD (the night)
  dropOffTime:    { type: String, required: true },              // HH:MM, evening
  pickUpTime:     { type: String, required: true },              // HH:MM, next morning
  hostId:         { type: ObjectId, ref: 'User', required: true }, // === requesterId or recipientId
  status:         { type: String, enum: ['pending','confirmed','declined','cancelled'], default: 'pending' },
  cancelledBy:    { type: ObjectId, ref: 'User', default: null },
  parentApprovalNeeded: { type: Boolean, default: false },
  parentApproved:       { type: Boolean, default: false },
  message:        { type: String, default: '' },
  createdAt:      { type: Date, default: Date.now },
});
```

`hostId` stores the actual host user's id. UI toggle maps: "My house" → `hostId = requesterId`,
"Their house" → `hostId = recipientId`.

## Backend — `server/routes/sleepovers.js`

Mirror `playdates.js` (same `serialize` shape + `$or` ownership pattern):

- `GET /` — sleepovers where user is requester or recipient, sorted `createdAt: -1`.
- `POST /` — body `{ recipientId, date, dropOffTime, pickUpTime, host, message }` where `host` is
  `'me' | 'them'`. **Validate** `recipientId, date, dropOffTime, pickUpTime, host` all present →
  400 otherwise. Resolve `hostId` from `host` (`me`→requester, `them`→recipient). Snapshot
  requester/recipient profile fields. `parentApprovalNeeded = requester.parentModeEnabled`.
- `POST /:id/confirm` — recipient + status `pending` → `confirmed` (mirror playdate).
- `POST /:id/decline` — recipient + status `pending` → `declined` (mirror playdate).
- `POST /:id/cancel` — **either** requester or recipient, status in `['pending','confirmed']` →
  `cancelled`, set `cancelledBy = userId`. The `$or: [{requesterId:userId},{recipientId:userId}]`
  filter is the authorization. 404 if not found / not cancellable.

Register in `server/app.js`: import `sleepoversRouter`, add
`app.use('/api/sleepovers', requireAuth, sleepoversRouter);` alongside the others (app.js:56-58).

Serializer returns the same fields plus `dropOffTime`, `pickUpTime`, `hostId`, `cancelledBy`.

## Frontend

### Types — `src/types.ts`
- Add `'sleepovers'` to the `Screen` union.
- Add:
```ts
export type SleepoverStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled';
export interface Sleepover {
  id: string;
  requesterId: string; recipientId: string;
  requesterName: string; requesterColor: string; requesterEmoji: string;
  recipientName: string; recipientColor: string; recipientEmoji: string;
  date: string; dropOffTime: string; pickUpTime: string;
  hostId: string;
  status: SleepoverStatus;
  cancelledBy: string | null;
  parentApprovalNeeded: boolean; parentApproved: boolean;
  message: string; createdAt: number;
}
```

### Navigation — `src/components/Layout.tsx`
Add a 5th tab to `TABS`: `{ screen: 'sleepovers', icon: '🛌', label: 'Sleepovers' }`. Extend the
badge logic so the sleepovers tab shows incoming-pending count (new optional
`sleepoversBadgeCount` prop, mirroring `friendsBadgeCount`). Five `flex-1` tabs fit the
`max-w-md` bar.

### New screen — `src/screens/SleepoversScreen.tsx`
Props: `currentUser`, `sleepovers`, `friends`, `onConfirm`, `onDecline`, `onCancel`,
`onRequestSleepover(friend)`. Layout mirrors `RequestsScreen` + a create entry point:
- Header "🛌 Sleepovers" and a prominent **"+ Plan a sleepover"** button → opens the modal
  (friend picker first, then the request modal).
- Incoming/Outgoing tabs (reuse `RequestsScreen`'s tab pattern).
- Each sleepover rendered as a card (new inline card or small `SleepoverCard` component) showing:
  the other person (emoji/name), **🏠 host** ("At your house" / "At {name}'s house" derived from
  `hostId`), date, **drop-off → pick-up** times (format via `formatTime` from `src/constants`),
  status pill, and message.
  - Incoming + `pending`: **Accept** / **Decline** buttons.
  - Any `pending`/`confirmed` (either side): **Cancel** button (two-tap confirm, reusing the
    kid-friendly confirm pattern from `FriendsScreen` remove-friend).
  - `declined`/`cancelled`: muted, no actions (show "Cancelled by {name}" when cancelled).

### New modal — `src/components/RequestSleepoverModal.tsx`
Mirror `RequestPlaydateModal` structure (bottom-sheet, friend header). Fields:
- **Date** picker (`min = today`), same as playdate modal.
- **Host toggle**: "🏠 My house" / "🏠 Their house" (two buttons like the playdate type toggle),
  maps to `host: 'me' | 'them'`.
- **Drop-off time** and **Pick-up time** — two `<input type="time">` fields (simpler and
  appropriate for arbitrary evening/morning clock times than the 15-min slot grid). Label pick-up
  as "next morning".
- **Message** (optional) textarea.
- Submit button disabled until `date && dropOffTime && pickUpTime` are all set (host defaults to
  "my house"). `onSubmit({ host, date, dropOffTime, pickUpTime, message })`.

Friend selection: since a sleepover starts from the Sleepovers page (not a friend's card), the
"+ Plan a sleepover" button first shows a simple friend list (reuse the friend-row styling from
`FriendsScreen`); picking a friend opens `RequestSleepoverModal` for them.

### App wiring — `src/App.tsx`
- New state `sleepovers: Sleepover[]`.
- Load in the initial `Promise.all` and add `refreshSleepovers` (mirror `refreshPlaydates`,
  App.tsx:70-73). Fetch `GET /api/sleepovers`.
- Handlers (mirror playdate handlers):
  - `handleCreateSleepover(friend, data)` → `POST /api/sleepovers` with `recipientId: friend.uid`,
    then `refreshSleepovers`.
  - `handleConfirmSleepover(id)` / `handleDeclineSleepover(id)` / `handleCancelSleepover(id)` →
    POST to the respective endpoints, then `refreshSleepovers`.
- Render `screen === 'sleepovers'` → `<SleepoversScreen ...>`; pass `friends` for the picker.
- Compute `pendingIncomingSleepovers` (recipient + pending) and pass as `sleepoversBadgeCount` to
  `Layout`.

## Out of scope (YAGNI)
- No editing an existing sleepover (cancel + recreate instead).
- No recurring sleepovers, no multi-night ranges (single night only).
- No calendar/notification integration beyond the in-app badge.

## Testing / Verification
1. `npm run build` (frontend typecheck) and start server + `npm run dev`.
2. Two accounts A, B (friends). A: Sleepovers → "+ Plan a sleepover" → pick B, choose date,
   "My house", set drop-off 19:00 + pick-up 09:00, send. Confirm Submit is disabled until both
   times set.
3. B sees incoming pending sleepover (badge on 🛌 tab) showing "At {A}'s house", 7:00 PM → 9:00 AM
   next morning. B Accepts → status confirmed for both.
4. A cancels the confirmed sleepover → both see `cancelled` / "Cancelled by {A}".
5. B declines a different pending one → declined, no actions.
6. Backend: `POST /api/sleepovers` missing `pickUpTime` → 400. `POST /:id/cancel` by a
   non-participant → 404.
7. After verifying, **commit and deploy** (push → Vercel; `server/deploy.ps1` → Lambda), per
   standing preference.
