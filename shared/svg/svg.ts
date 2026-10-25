// String-built SVG, so the server can draw pieces without JSX (Node strips types but does not compile JSX)

// One drawing the server offers: `params` names its URL parameters for the gallery, `samples` are parameter sets to show
// there, and `render` returns the full <svg> document, or null for parameters it does not draw
export type SvgAsset = {
  name: string;
  params: string[];
  samples: string[][];
  render: (params: string[]) => string | null;
};

export type Attrs = Record<string, string | number | undefined>;

export function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}

export function el(tag: string, attrs: Attrs, ...children: string[]): string {
  const list = Object.entries(attrs)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ` ${key}="${escapeAttr(String(value))}"`)
    .join('');
  return children.length === 0 ? `<${tag}${list}/>` : `<${tag}${list}>${children.join('')}</${tag}>`;
}

export function svgDoc(viewBox: string, attrs: Attrs, ...children: string[]): string {
  return el('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox, ...attrs }, ...children);
}
