import { KID_EMOJIS } from '../constants';

interface Props {
  value: string;
  onChange: (emoji: string) => void;
}

export default function EmojiPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {KID_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onChange(emoji)}
          className={`text-3xl p-2 rounded-2xl transition-transform active:scale-90 focus:outline-none ${
            value === emoji ? 'bg-white shadow-md scale-110' : 'hover:bg-white/50'
          }`}
          aria-label={emoji}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
