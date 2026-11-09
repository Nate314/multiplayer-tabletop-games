// The prompt in large type, shown only to the actor while acting
export default function PromptCard({ prompt }: { prompt: string }) {
  return <div className="charades-prompt" role="status" aria-label="Your prompt">{prompt}</div>;
}
