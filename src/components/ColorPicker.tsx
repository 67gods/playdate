import { KID_COLORS } from '../constants';

interface Props {
  value: string;
  onChange: (color: string) => void;
}

export default function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-3 justify-center">
      {KID_COLORS.map((c) => (
        <button
          key={c.value}
          onClick={() => onChange(c.value)}
          className="w-12 h-12 rounded-full transition-transform active:scale-90 focus:outline-none"
          style={{
            backgroundColor: c.value,
            transform: value === c.value ? 'scale(1.25)' : undefined,
            boxShadow: value === c.value ? `0 0 0 3px white, 0 0 0 5px ${c.value}` : undefined,
          }}
          aria-label={c.name}
        />
      ))}
    </div>
  );
}
