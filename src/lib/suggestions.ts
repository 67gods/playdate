import type { Friend, SuggestionBlock, UserProfile } from '../types';
import { DAYS, addMinutes, dateToDayKey } from '../constants';

export function computeSuggestions(
  currentUser: UserProfile,
  friends: Friend[]
): SuggestionBlock[] {
  if (friends.length === 0) return [];

  const blocks: SuggestionBlock[] = [];
  const now     = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  for (let offset = 0; offset <= 6; offset++) {
    const date    = new Date(now);
    date.setDate(now.getDate() + offset);
    const dayKey  = dateToDayKey(date);
    const dateStr = date.toISOString().split('T')[0];

    const mySlots = [...(currentUser.availability[dayKey] ?? [])].sort();
    if (mySlots.length === 0) continue;

    let currentBlock: SuggestionBlock | null = null;

    for (const slot of mySlots) {
      // Skip slots already past today
      if (offset === 0) {
        const [sh, sm] = slot.split(':').map(Number);
        if (sh * 60 + sm <= nowMins) continue;
      }

      const availFriends = friends.filter((f) =>
        (f.availability[dayKey] ?? []).includes(slot)
      );
      if (availFriends.length === 0) {
        if (currentBlock) { blocks.push(currentBlock); currentBlock = null; }
        continue;
      }

      // Extend block if same friends and consecutive
      const sameSet =
        currentBlock &&
        availFriends.length === currentBlock.friends.length &&
        availFriends.every((f) => currentBlock!.friends.some((cf) => cf.uid === f.uid));

      if (currentBlock && sameSet && currentBlock.endSlot === slot) {
        currentBlock.endSlot = addMinutes(slot, 15);
      } else {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = {
          date:      dateStr,
          day:       dayKey,
          startSlot: slot,
          endSlot:   addMinutes(slot, 15),
          friends:   availFriends,
        };
      }
    }
    if (currentBlock) blocks.push(currentBlock);
  }

  // Sort: most friends first, then soonest
  return blocks.sort((a, b) => {
    if (b.friends.length !== a.friends.length) return b.friends.length - a.friends.length;
    return (a.date + a.startSlot).localeCompare(b.date + b.startSlot);
  });
}

export function friendlyDate(dateStr: string): string {
  const date   = new Date(dateStr + 'T12:00:00');
  const today  = new Date();
  const diff   = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  const day = DAYS.find((d) => d.key === dateToDayKey(date));
  return day?.label ?? date.toLocaleDateString();
}
