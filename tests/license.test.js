import { describe, it, expect, beforeEach } from 'vitest';
import { License } from '../lib/license.js';

function reset() {
  License.plan = 'free';
  License.key = null;
  License.expiresAt = null;
}

describe('License Pro expiration', () => {
  beforeEach(reset);

  it('starts free with no storage (node has no chrome.storage)', async () => {
    expect(await License.init()).toBe('free');
    expect(License.isPro()).toBe(false);
  });

  it('activates a perpetual key', async () => {
    await License.activate('TT-PRO-ABCD-1234-EFGH');
    expect(License.isPro()).toBe(true);
    expect(License.expiresAt).toBe(null);
  });

  it('activates a key with a future expiration', async () => {
    const future = new Date(Date.now() + 30 * 86400000).toISOString();
    await License.activate('TT-PRO-ABCD-1234-EFGH', future);
    expect(License.isPro()).toBe(true);
  });

  it('rejects activation with a past expiration', async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    await expect(License.activate('TT-PRO-ABCD-1234-EFGH', past)).rejects.toThrow('LICENSE_EXPIRED');
    expect(License.isPro()).toBe(false);
  });

  it('treats a lapsed key as free', async () => {
    await License.activate('TT-PRO-ABCD-1234-EFGH');
    expect(License.isPro()).toBe(true);
    License.expiresAt = new Date(Date.now() - 1000).toISOString();
    expect(License.isPro()).toBe(false);
  });

  it('rejects malformed keys as before', async () => {
    await expect(License.activate('WRONG-KEY')).rejects.toThrow('INVALID_LICENSE');
    await expect(License.activate('TT-PRO-1234567890')).rejects.toThrow('INVALID_LICENSE');
    await expect(License.activate('TT-PRO-0000-0000-0000')).rejects.toThrow('INVALID_LICENSE');
  });

  it('deactivate clears expiry state', async () => {
    await License.activate('TT-PRO-ABCD-1234-EFGH', new Date(Date.now() + 86400000).toISOString());
    await License.deactivate();
    expect(License.isPro()).toBe(false);
    expect(License.expiresAt).toBe(null);
  });
});
