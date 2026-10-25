// Every SVG the server draws: the routes and the /dev/svgs gallery both read this list, so a new asset is one entry
export type SvgAsset = {
  name: string;
  params: string[];
  samples: string[][];
  render: (params: string[]) => string | null;
};

export const SVG_ASSETS: SvgAsset[] = [];

export function findSvg(name: string, assets: SvgAsset[] = SVG_ASSETS): SvgAsset | undefined {
  return assets.find(asset => asset.name === name);
}
