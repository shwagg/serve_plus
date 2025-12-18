// This script adds a test audit log entry to Firestore for debugging UI display.
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp({
  credential: applicationDefault(),
});

const db = getFirestore();

async function addTestAuditLog() {
  await db.collection('auditLogs').add({
    uid: 'test-user-123',
    email: 'testuser@example.com',
    action: 'LOGIN',
    timestamp: FieldValue.serverTimestamp(),
  });
  console.log('Test audit log added!');
}

addTestAuditLog();
