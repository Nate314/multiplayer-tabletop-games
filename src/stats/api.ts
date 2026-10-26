import { deviceId } from '../services/device.ts';

// Every stats route is a POST carrying the device ID in its body, never in the URL.
// A 400 with an error (a used link code) comes back as the answer; any other failure throws
export async function postStats<T>(path: string, body: object = {}): Promise<T> {
  const response = await fetch(`/api/stats${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, deviceId: deviceId() })
  });
  const answer = await response.json() as T;
  if (!response.ok && !(answer && typeof answer === 'object' && 'error' in answer)) throw new Error(String(response.status));
  return answer;
}
