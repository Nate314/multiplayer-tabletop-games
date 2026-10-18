// Saves data as a pretty-printed JSON file through the browser's download
export function downloadJson(fileName: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Safari and iOS may still be reading the file just after the click
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
