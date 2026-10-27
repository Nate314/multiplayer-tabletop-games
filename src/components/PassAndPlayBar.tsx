type PassAndPlayBarProps = {
  name: string;
  onPass: () => void;
};

// Above a shared device's game screen: whose hand is showing, and a way to hide it before handing over
export default function PassAndPlayBar({ name, onPass }: PassAndPlayBarProps) {
  return (
    <div className="pass-and-play-bar">
      <span>{`Playing as ${name}`}</span>
      <button type="button" className="themed-chip" onClick={onPass}>Pass the device</button>
    </div>
  );
}
