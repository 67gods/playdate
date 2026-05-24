export type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type PlaydateStatus = 'pending' | 'confirmed' | 'declined';
export type Screen = 'home' | 'availability' | 'friends' | 'requests';

// availability: per-day array of available "HH:MM" 24-hour strings
export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  color: string;
  emoji: string;
  parentModeEnabled: boolean;
  availability: Partial<Record<Day, string[]>>;
}

export interface Playdate {
  id: string;
  requesterId: string;
  recipientId: string;
  requesterName: string;
  requesterColor: string;
  requesterEmoji: string;
  recipientName: string;
  recipientColor: string;
  recipientEmoji: string;
  date: string;        // YYYY-MM-DD
  timeSlots: string[]; // sorted HH:MM (24-hour) slots, each 15 min
  type: 'playdate' | 'meeting';
  status: PlaydateStatus;
  parentApprovalNeeded: boolean;
  parentApproved: boolean;
  message: string;
  createdAt: number;
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  fromUsername: string;
  fromDisplayName: string;
  fromColor: string;
  fromEmoji: string;
  toUid: string;
  toUsername: string;
  status: 'pending' | 'accepted';
  createdAt: number;
}

export interface Friend {
  uid: string;
  username: string;
  displayName: string;
  color: string;
  emoji: string;
  availability: Partial<Record<Day, string[]>>;
}

export interface SuggestionBlock {
  date: string;       // YYYY-MM-DD
  day: Day;
  startSlot: string;  // HH:MM
  endSlot: string;    // HH:MM exclusive (last slot + 15 min)
  friends: Friend[];
}
