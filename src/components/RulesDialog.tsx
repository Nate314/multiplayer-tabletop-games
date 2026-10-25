import { useEffect, useId, useState } from 'react';
import FaqList from './FaqList';
import { REPO_URL } from './GitHubLink';
import Markdown from '../markdown/Markdown';
import { parseMarkdown, type Block } from '../markdown/parseMarkdown.ts';
import useEscapeKey from '../hooks/useEscapeKey';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import type { FaqItem } from '../clientGames.ts';

type RulesDialogProps = {
  game: GameInfo;
  faq: FaqItem[];
  onClose: () => void;
};

type Rules = { status: 'loading' } | { status: 'failed' } | { status: 'loaded'; blocks: Block[] };

// The README's own # title is dropped, since the dialog's title says it
function withoutTitle(blocks: Block[]): Block[] {
  const title = blocks.findIndex(block => block.kind === 'heading' && block.level === 1);
  return blocks.filter((_, i) => i !== title);
}

// Web links open as they are; a path to another repo file opens it on GitHub; anchors and other schemes stay text
function linkResolver(gameId: string) {
  return (href: string): string | null => {
    if (/^https?:\/\//i.test(href)) return href;
    if (href.startsWith('#') || /^[a-z][a-z\d+.-]*:/i.test(href)) return null;
    return new URL(href, `${REPO_URL}/blob/master/games/${gameId}/`).href;
  };
}

export default function RulesDialog({ game, faq, onClose }: RulesDialogProps) {
  useEscapeKey(onClose);
  const titleId = useId();
  const [view, setView] = useState<'rules' | 'faq'>('rules');
  const [rules, setRules] = useState<Rules>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    fetch(`/api/rules/${game.id}`)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then(text => { if (current) setRules({ status: 'loaded', blocks: withoutTitle(parseMarkdown(text)) }); })
      .catch(() => { if (current) setRules({ status: 'failed' }); });
    return () => { current = false; };
  }, [game.id, attempt]);

  function retry() {
    setRules({ status: 'loading' });
    setAttempt(count => count + 1);
  }

  let body;
  if (view === 'faq') {
    body = <div className="faq"><FaqList items={faq} /></div>;
  } else if (rules.status === 'loading') {
    body = <p>Loading the rules...</p>;
  } else if (rules.status === 'failed') {
    body = (
      <div className="rules-failed">
        <p>Could not load the rules</p>
        <button type="button" className="primary-button" onClick={retry}>Retry</button>
      </div>
    );
  } else {
    body = <div className="markdown"><Markdown blocks={rules.blocks} resolveLink={linkResolver(game.id)} /></div>;
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal rules" role="dialog" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <h2 id={titleId}>{`${game.name} rules`}</h2>
        <div className="rules-switch">
          <button type="button" aria-pressed={view === 'rules'} onClick={() => setView('rules')}>Rules</button>
          <button type="button" aria-pressed={view === 'faq'} onClick={() => setView('faq')}>FAQ</button>
        </div>
        <div className="rules-body" key={view}>{body}</div>
        <button type="button" className="primary-button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
