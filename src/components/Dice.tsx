// Pip positions on a 3 by 3 grid, numbered 0-8 from the top left
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

const pips = (value: number) =>
  Array.from({ length: 9 }, (_, spot) => <span key={spot} className={PIPS[value]?.includes(spot) ? 'dice-pip' : ''} />);

type DieProps = {
  value: number;
  className?: string; // added to dice-die, for a game's own look
  label?: string; // without it the die is not announced on its own, e.g. when its row has a label
  title?: string;
  animKey?: string;
};

// One six-sided die face
export function Die({ value, className, label, title, animKey }: DieProps) {
  return (
    <span
      className={className ? `dice-die ${className}` : 'dice-die'}
      role={label === undefined ? undefined : 'img'}
      aria-label={label}
      title={title}
      data-anim-key={animKey}
    >
      {pips(value)}
    </span>
  );
}

type DiceProps = {
  values: number[];
  selected?: boolean[]; // which dice are picked, e.g. held
  // Given only when the player can pick dice; without it the dice are not buttons
  onToggle?: (index: number) => void;
  disabled?: boolean;
  label: string;
  animKeyPrefix?: string; // for move animations: each die gets `${animKeyPrefix}-${index}`
};

// A row of six-sided dice, shared by the games that roll them
export default function Dice({ values, selected = [], onToggle, disabled = false, label, animKeyPrefix }: DiceProps) {
  return (
    <div className="dice-row" role="group" aria-label={label}>
      {values.map((value, index) => {
        const className = selected[index] ? 'dice-die-selected' : undefined;
        const animKey = animKeyPrefix ? `${animKeyPrefix}-${index}` : undefined;
        const dieLabel = `die ${index + 1}: ${value}`;
        return onToggle ? (
          <button
            key={index}
            className={className ? `dice-die ${className}` : 'dice-die'}
            data-anim-key={animKey}
            type="button"
            aria-pressed={Boolean(selected[index])}
            aria-label={dieLabel}
            disabled={disabled}
            onClick={() => onToggle(index)}
          >
            {pips(value)}
          </button>
        ) : (
          <Die key={index} value={value} className={className} label={dieLabel} animKey={animKey} />
        );
      })}
    </div>
  );
}
