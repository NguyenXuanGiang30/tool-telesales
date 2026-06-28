/* eslint-disable */
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

let testEnv;

beforeAll(async () => {
  const rules = fs.readFileSync(path.resolve(__dirname, 'DRAFT_firestore.rules'), 'utf8');
  testEnv = await initializeTestEnvironment({
    projectId: 'test-project',
    firestore: { rules },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('Firestore Rules', () => {
  it('allows owner to read campaign', async () => {
    const db = testEnv.authenticatedContext('user123', { email: 'test@example.com' }).firestore();
    const docRef = db.collection('users').doc('user123').collection('campaigns').doc('camp1');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('users/user123/campaigns/camp1').set({ userId: 'user123' });
    });
    await assertSucceeds(docRef.get());
  });

  it('denies spoofing user ID', async () => {
    const db = testEnv.authenticatedContext('attacker').firestore();
    const docRef = db.collection('users').doc('user123').collection('campaigns').doc('camp2');
    await assertFails(docRef.set({
      userId: 'attacker',
      name: 'Spoofed Campaign',
      status: 'paused',
      progress: 0,
      total: 0,
      type: 'callbot',
      createdAt: testEnv.firestore.FieldValue.serverTimestamp(),
      updatedAt: testEnv.firestore.FieldValue.serverTimestamp()
    }));
  });
});
