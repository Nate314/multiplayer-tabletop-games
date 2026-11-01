type DigitPadProps = {
  disabled: boolean;
  pencil: boolean;
  canErase: boolean;
  onDigit: (digit: number) => void;
  onErase: () => void;
  onPencil: () => void;
};

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// The digits 1 to 9, then Pencil (pencil marks instead of entries) and Erase
export default function DigitPad({ disabled, pencil, canErase, onDigit, onErase, onPencil }: DigitPadProps) {
  return (
    <div className="digit-pad">
      <div className="digits" role="group" aria-label="Digits">
        {DIGITS.map(digit => (
          <button key={digit} type="button" disabled={disabled} onClick={() => onDigit(digit)}>{digit}</button>
        ))}
      </div>
      <div className="pad-tools">
        <button type="button" aria-pressed={pencil} onClick={onPencil}>Pencil</button>
        <button type="button" disabled={disabled || !canErase} onClick={onErase}>Erase</button>
      </div>
    </div>
  );
}
