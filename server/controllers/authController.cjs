const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User, AuthSession } = require('./db.cjs');

// Session timeout configurations (in milliseconds)
const SESSION_INACTIVITY_TIMEOUT_MS = (parseInt(process.env.SESSION_INACTIVITY_TIMEOUT_MINUTES) || 1440) * 60 * 1000;
const SESSION_MAX_DURATION_MS = (parseInt(process.env.SESSION_MAX_DURATION_MINUTES) || 43200) * 60 * 1000;

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_MAX_DURATION_MS);
  try {
    await AuthSession.create({
      data: {
        user_id: userId,
        token,
        expires_at: expiresAt
      }
    });
    return token;
  } catch (err) {
    console.error('Create session error:', err);
    throw err;
  }
}

async function destroySession(token) {
  try {
    await AuthSession.deleteMany({ where: { token } });
  } catch (err) {
    console.error('Destroy session error:', err);
  }
}

async function getSession(token) {
  try {
    const session = await AuthSession.findFirst({
      where: { token },
      include: { user: { select: { username: true, role: true } } }
    });
    if (!session) {
      return null;
    }

    const now = new Date();
    const updatedAt = new Date(session.updated_at);
    const createdAt = new Date(session.created_at);

    // Check inactivity (using updated_at as last activity)
    if (now.getTime() - updatedAt.getTime() > SESSION_INACTIVITY_TIMEOUT_MS) {
      await AuthSession.deleteMany({ where: { token } });
      return null;
    }

    // Check max usage
    if (now.getTime() - createdAt.getTime() > SESSION_MAX_DURATION_MS) {
      await AuthSession.deleteMany({ where: { token } });
      return null;
    }

    // Check expiration
    const expiresAt = new Date(session.expires_at);
    if (now > expiresAt) {
      await AuthSession.deleteMany({ where: { token } });
      return null;
    }

    // Update last activity (updated_at)
    await AuthSession.updateMany({
      where: { token },
      data: {}
    }); // updated_at auto-updates

    return { username: session.user.username, role: session.user.role };
  } catch (err) {
    console.error('Get session error:', err);
    return null;
  }
}

async function cleanupExpiredSessions() {
  try {
    const now = new Date();
    const result = await AuthSession.deleteMany({
      where: {
        OR: [
          { expires_at: { lt: now } },
          { updated_at: { lt: new Date(now.getTime() - SESSION_INACTIVITY_TIMEOUT_MS) } },
          { created_at: { lt: new Date(now.getTime() - SESSION_MAX_DURATION_MS) } }
        ]
      }
    });
  } catch (err) {
    console.error('Cleanup sessions error:', err);
  }
}

async function verifyUser(username, password) {
  try {
    const user = await User.findFirst({ where: { username } });
    if (!user) return null;
    const match = await bcrypt.compare(password, user.password);
    if (!match) return null;
    return { id: user.id, username: user.username, role: user.role };
  } catch (err) {
    console.error('Verify user error:', err);
    throw err;
  }
}

async function createUser(username, password, role) {
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ data: { username, password: hashedPassword, role } });
    return { id: user.id, username: user.username, role: user.role };
  } catch (err) {
    console.error('Create user error:', err);
    throw err;
  }
}

async function listUsers(offset = 0) {
  try {
    const users = await User.findMany({
      select: { id: true, username: true, role: true },
      take: 100,
      skip: offset
    });
    return users;
  } catch (err) {
    console.error('List users error:', err);
    throw err;
  }
}

async function updateUserPassword(username, newPassword) {
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.updateMany({
      where: { username },
      data: { password: hashedPassword }
    });
  } catch (err) {
    console.error('Update user password error:', err);
    throw err;
  }
}

async function deleteUser(username) {
  try {
    await User.deleteMany({ where: { username } });
  } catch (err) {
    console.error('Delete user error:', err);
    throw err;
  }
}

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Benutzer anmelden
 *     tags: [Authentifizierung]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Erfolgreiche Anmeldung
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 role:
 *                   type: string
 *       400:
 *         description: Fehlende Anmeldedaten
 *       401:
 *         description: Ungültige Anmeldedaten
 *       500:
 *         description: Serverfehler
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }
  try {
    const user = await verifyUser(username, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = await createSession(user.id);
    const secureCookie = true; // Use HTTPS in production
    const sameSite = 'strict';
    res.cookie('session_token', token, {
      httpOnly: true,
      secure: secureCookie,
      maxAge: SESSION_INACTIVITY_TIMEOUT_MS,
      sameSite
    });
    res.json({ role: user.role });
  } catch (err) {
    console.error('Login failed:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * @swagger
 * /api/validate:
 *   get:
 *     summary: Session validieren
 *     tags: [Authentifizierung]
 *     responses:
 *       200:
 *         description: Session ist gültig
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 username:
 *                   type: string
 *                 role:
 *                   type: string
 *       401:
 *         description: Ungültige oder abgelaufene Session
 */
router.get('/validate', async (req, res) => {
  const token = req.cookies.session_token;
  const session = token && await getSession(token);
  if (session) {
    res.json({ valid: true, username: session.username, role: session.role });
  } else {
    res.status(401).json({ valid: false, error: 'Invalid or expired token' });
  }
});

/**
 * @swagger
 * /api/logout:
 *   post:
 *     summary: Benutzer abmelden
 *     tags: [Authentifizierung]
 *     responses:
 *       200:
 *         description: Erfolgreiche Abmeldung
 */
router.post('/logout', async (req, res) => {
  const token = req.cookies.session_token;
  if (token) {
    await destroySession(token);
  }
  res.clearCookie('session_token');
  res.json({ success: true });
});

module.exports = {
    router,
    getSession,
    createSession,
    verifyUser,
    createUser,
    listUsers,
    updateUserPassword,
    deleteUser,
    cleanupExpiredSessions
};