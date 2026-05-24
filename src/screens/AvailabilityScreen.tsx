import type { Day, UserProfile } from '../types';
import TimeSlotPicker from '../components/TimeSlotPicker';

interface Props {
  currentUser: UserProfile;
  onSaveDay: (day: Day, slots: string[]) => void;
}

export default function AvailabilityScreen({ currentUser, onSaveDay }: Props) {
  const totalSlots = Object.values(currentUser.availability).reduce(
    (sum, s) => sum + (s?.length ?? 0), 0
  );

  return (
    <div>
      <h1 className="font-black text-2xl text-gray-800 mb-1">📅 My Time</h1>
      <p className="text-gray-500 font-semibold mb-1">
        Tap or drag to mark when you're free. Friends will see this!
      </p>
      {totalSlots > 0 && (
        <p className="text-xs font-bold mb-4" style={{ color: currentUser.color }}>
          {totalSlots} free slot{totalSlots !== 1 ? 's' : ''} set this week
        </p>
      )}

      <TimeSlotPicker
        availability={currentUser.availability}
        color={currentUser.color}
        onSaveDay={onSaveDay}
      />
    </div>
  );
}
