import type { Block, Inline } from './parseMarkdown.ts';

type MarkdownProps = {
  blocks: Block[];
  // The address to open, or null to show the link's text without a link
  resolveLink: (href: string) => string | null;
};

export default function Markdown({ blocks, resolveLink }: MarkdownProps) {
  return <>{blocks.map((block, i) => <BlockView key={i} block={block} resolveLink={resolveLink} />)}</>;
}

type Resolve = MarkdownProps['resolveLink'];

function BlockView({ block, resolveLink, tight = false }: { block: Block; resolveLink: Resolve; tight?: boolean }) {
  switch (block.kind) {
    case 'heading': {
      const Heading = `h${block.level}` as const;
      return <Heading><Inlines items={block.children} resolveLink={resolveLink} /></Heading>;
    }
    case 'paragraph':
      return tight ? <Inlines items={block.children} resolveLink={resolveLink} /> : <p><Inlines items={block.children} resolveLink={resolveLink} /></p>;
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      return (
        <List>
          {block.items.map((item, i) => {
            // An item of one line of text and maybe a nested list shows without paragraph spacing
            const itemTight = item.filter(child => child.kind === 'paragraph').length <= 1;
            return <li key={i}>{item.map((child, j) => <BlockView key={j} block={child} resolveLink={resolveLink} tight={itemTight} />)}</li>;
          })}
        </List>
      );
    }
    case 'code':
      return <pre><code>{block.text}</code></pre>;
    case 'table':
      return (
        // Wide tables scroll sideways on a phone instead of widening the dialog
        <div className="markdown-table">
          <table>
            <thead>
              <tr>{block.header.map((cell, i) => <th key={i}><Inlines items={cell} resolveLink={resolveLink} /></th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>{row.map((cell, j) => <td key={j}><Inlines items={cell} resolveLink={resolveLink} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'rule':
      return <hr />;
  }
}

function Inlines({ items, resolveLink }: { items: Inline[]; resolveLink: Resolve }) {
  return (
    <>
      {items.map((item, i) => {
        switch (item.kind) {
          case 'text': return item.text;
          case 'strong': return <strong key={i}>{item.text}</strong>;
          case 'em': return <em key={i}>{item.text}</em>;
          case 'code': return <code key={i}>{item.text}</code>;
          case 'link': {
            const href = resolveLink(item.href);
            const children = <Inlines items={item.children} resolveLink={resolveLink} />;
            return href ? <a key={i} href={href} target="_blank" rel="noreferrer">{children}</a> : <span key={i}>{children}</span>;
          }
        }
      })}
    </>
  );
}
