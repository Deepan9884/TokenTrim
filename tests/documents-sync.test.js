import { describe, it, expect, beforeEach } from 'vitest';
import { getStore } from '../admin/lib/store.ts';
import { AdminAPI } from '../lib/admin-api.js';

describe('AdminAPI cloud sync preference', () => {
  it('defaults to true when unset', async () => {
    const enabled = await AdminAPI.isCloudSyncEnabled();
    expect(enabled).toBe(true);
  });

  it('toggles cloud sync preference', async () => {
    await AdminAPI.setCloudSyncEnabled(false);
    expect(await AdminAPI.isCloudSyncEnabled()).toBe(false);

    await AdminAPI.setCloudSyncEnabled(true);
    expect(await AdminAPI.isCloudSyncEnabled()).toBe(true);
  });
});

describe('Store user document persistence (Demo / Supabase store layer)', () => {
  const store = getStore();
  const testUserId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    await store.resetForTests();
  });

  it('saves and lists user documents', async () => {
    const docId = await store.saveUserDocument(testUserId, {
      title: 'Quarterly Report.pdf',
      preset: 'claude',
      markdown: '# Quarterly Report\n\nAll metrics are positive.',
      chunks: ['# Quarterly Report', 'All metrics are positive.'],
      pages: 5,
      tokens: 1200
    });

    expect(docId).toMatch(/^doc_/);

    const list = await store.listUserDocuments(testUserId);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(docId);
    expect(list[0].title).toBe('Quarterly Report.pdf');
    expect(list[0].preset).toBe('claude');
    expect(list[0].pages).toBe(5);
    expect(list[0].tokens).toBe(1200);
    expect(list[0].chunkCount).toBe(2);
  });

  it('retrieves full document by ID', async () => {
    const docId = await store.saveUserDocument(testUserId, {
      title: 'Specification.docx',
      preset: 'chatgpt',
      markdown: '# Spec\n\nFull technical specs here.',
      chunks: ['# Spec', 'Full technical specs here.'],
      pages: 2,
      tokens: 450
    });

    const doc = await store.getUserDocument(testUserId, docId);
    expect(doc).not.toBeNull();
    expect(doc?.id).toBe(docId);
    expect(doc?.title).toBe('Specification.docx');
    expect(doc?.markdown).toContain('Full technical specs here.');
    expect(doc?.chunks).toHaveLength(2);
  });

  it('deletes document for user', async () => {
    const docId = await store.saveUserDocument(testUserId, {
      title: 'Temp.pdf',
      markdown: 'Temporary content',
      pages: 1,
      tokens: 50
    });

    const deleted = await store.deleteUserDocument(testUserId, docId);
    expect(deleted).toBe(true);

    const list = await store.listUserDocuments(testUserId);
    expect(list).toHaveLength(0);

    const doc = await store.getUserDocument(testUserId, docId);
    expect(doc).toBeNull();
  });
});
