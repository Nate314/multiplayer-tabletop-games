// Row-major grid: index = row * cols + col. Edges and missing cells keep the index.
export function gridStep(index: number, key: string, cols: number, count: number): number | null {
  const col = index % cols;
  switch (key) {
    case 'ArrowRight':
      return col < cols - 1 && index + 1 < count ? index + 1 : index;
    case 'ArrowLeft':
      return col > 0 ? index - 1 : index;
    case 'ArrowUp':
      return index - cols >= 0 ? index - cols : index;
    case 'ArrowDown':
      return index + cols < count ? index + cols : index;
    default:
      return null;
  }
}
