// A paint-bucket fill of the region of similar color around (x, y), in place. A scanline fill on a stack rather than
// recursion, so a large region cannot overflow the call stack; the tolerance takes in the antialiased pixels at an edge
export function floodFill(
  pixels: Uint8ClampedArray, width: number, height: number, x: number, y: number,
  rgba: [number, number, number, number], tolerance = 32
): void {
  const start = (y * width + x) * 4;
  const target = [pixels[start], pixels[start + 1], pixels[start + 2], pixels[start + 3]];
  if (target.every((value, i) => value === rgba[i])) return;
  const seen = new Uint8Array(width * height);
  const matches = (pixel: number) => !seen[pixel]
    && target.every((value, i) => Math.abs(pixels[pixel * 4 + i] - value) <= tolerance);
  const stack = [y * width + x];
  while (stack.length > 0) {
    const pixel = stack.pop() as number;
    if (!matches(pixel)) continue;
    const row = Math.floor(pixel / width);
    let left = pixel;
    while (left % width > 0 && matches(left - 1)) left--;
    let right = pixel;
    while (right % width < width - 1 && matches(right + 1)) right++;
    for (let p = left; p <= right; p++) {
      seen[p] = 1;
      pixels.set(rgba, p * 4);
      if (row > 0 && matches(p - width)) stack.push(p - width);
      if (row < height - 1 && matches(p + width)) stack.push(p + width);
    }
  }
}
