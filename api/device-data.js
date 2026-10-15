import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

function getAdminDatabase() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON environment variable');
  }
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
      databaseURL: 'https://bubosoft-shield-default-rtdb.firebaseio.com'
    });
  }
  return getDatabase();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expectedKey = process.env.ESP32_DEVICE_KEY;
  const suppliedKey = req.headers['x-device-key'];
  if (!expectedKey || !suppliedKey || suppliedKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized device' });
  }

  try {
    const body = req.body || {};
    const allowed = ['latest', 'summary', 'history', 'notifications'];
    if (!allowed.includes(body.type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }

    const db = getAdminDatabase();
    const now = Date.now();

    if (body.type === 'latest') {
      if (!body.data || typeof body.data !== 'object') {
        return res.status(400).json({ error: 'Missing data object' });
      }
      await db.ref('machine/latest').set({
        ...body.data,
        receivedAt: now,
        demoMode: body.data.demoMode === true
      });
    } else if (body.type === 'summary') {
      if (!body.data || typeof body.data !== 'object') {
        return res.status(400).json({ error: 'Missing data object' });
      }
      await db.ref('production/summary').set({
        ...body.data,
        receivedAt: now,
        demoMode: body.data.demoMode === true
      });
    } else {
      if (!body.data || typeof body.data !== 'object') {
        return res.status(400).json({ error: 'Missing data object' });
      }
      const collection = body.type === 'history'
        ? 'production/history'
        : 'notifications';
      await db.ref(collection).push({
        ...body.data,
        receivedAt: now,
        demoMode: body.data.demoMode === true
      });
    }

    return res.status(200).json({ ok: true, receivedAt: now });
  } catch (error) {
    console.error('Device endpoint error:', error.message);
    return res.status(500).json({ error: 'Server could not save data' });
  }
}
