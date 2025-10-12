const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User, AuthSession } = require('./db.cjs');

async function createSession(username, role) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  try {
    await AuthSession.create({
      session_token: token,
      username,
      role,
      expires_at: expiresAt
    });
    console.log('Created session:', { token: token.substring(0, 10) + '...', username, role, expires_at: expiresAt.toISOString() });
    return token;
  } catch (err) {
    console.error('Create session error:', err);
    throw err;
  }
}

async function destroySession(token) {
  console.log('Destroying session:', token);
  try {
    await AuthSession.destroy({ where: { session_token: token } });
  } catch (err) {
    console.error('Destroy session error:', err);
  }
}

async function getSession(token) {
  try {
    console.log('getSession called with token:', token ? `${token.substring(0, 10)}...` : 'null');
    const session = await AuthSession.findOne({ where: { session_token: token } });
    if (!session) {
      console.log('Session not found for token:', token ? `${token.substring(0, 10)}...` : 'null');
      return null;
    }

    const now = new Date();
    const lastActivity = new Date(session.last_activity);
    const createdAt = new Date(session.created_at);
    const expiresAt = new Date(session.expires_at);

    console.log('Session found:', {
      username: session.username,
      role: session.role,
      created_at: session.created_at,
      last_activity: session.last_activity,
      expires_at: session.expires_at,
      now: now.toISOString()
    });

    // Check inactivity: 24 hours since last activity
    if (now.getTime() - lastActivity.getTime() > 24 * 60 * 60 * 1000) {
      console.log('Session expired due to inactivity for token:', token ? `${token.substring(0, 10)}...` : 'null');
      await AuthSession.destroy({ where: { session_token: token } });
      return null;
    }

    // Check max usage: 30 days since creation
    if (now.getTime() - createdAt.getTime() > 30 * 24 * 60 * 60 * 1000) {
      console.log('Session expired due to max usage for token:', token ? `${token.substring(0, 10)}...` : 'null');
      await AuthSession.destroy({ where: { session_token: token } });
      return null;
    }

    // Update last activity
    await AuthSession.update(
      { last_activity: now },
      { where: { session_token: token } }
    );

    console.log('Session retrieved and refreshed for user:', session.username);
    return { username: session.username, role: session.role };
  } catch (err) {
    console.error('Get session error:', err);
    return null;
  }
}

async function cleanupExpiredSessions() {
  try {
    const now = new Date();
    const result = await AuthSession.destroy({
      where: {
        [require('sequelize').Op.or]: [
          { expires_at: { [require('sequelize').Op.lt]: now } },
          { last_activity: { [require('sequelize').Op.lt]: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
          { created_at: { [require('sequelize').Op.lt]: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } }
        ]
      }
    });
    if (result > 0) {
      console.log(`Cleaned up ${result} expired sessions`);
    }
  } catch (err) {
    console.error('Cleanup sessions error:', err);
  }
}

async function verifyUser(username, password) {
  try {
    const user = await User.findOne({ where: { username } });
    if (!user) return null;
    const match = await bcrypt.compare(password, user.password);
    if (!match) return null;
    return { username: user.username, role: user.role };
  } catch (err) {
    console.error('Verify user error:', err);
    throw err;
  }
}

async function createUser(username, password, role) {
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hashedPassword, role });
    return { id: user.id, username: user.username, role: user.role };
  } catch (err) {
    console.error('Create user error:', err);
    throw err;
  }
}

async function listUsers() {
  try {
    const users = await User.findAll({ attributes: ['id', 'username', 'role'] });
    return users;
  } catch (err) {
    console.error('List users error:', err);
    throw err;
  }
}

async function updateUserPassword(username, newPassword) {
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.update({ password: hashedPassword }, { where: { username } });
  } catch (err) {
    console.error('Update user password error:', err);
    throw err;
  }
}

async function deleteUser(username) {
  try {
    await User.destroy({ where: { username } });
  } catch (err) {
    console.error('Delete user error:', err);
    throw err;
  }
}

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
    const token = await createSession(user.username, user.role);
    // secure: true should be used in production when using HTTPS
     const secureCookie = false; // Temporarily disable for HTTP testing
     const sameSite = 'lax'; // Use lax for testing
    res.cookie('session_token', token, {
      httpOnly: true,
      secure: secureCookie,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite
    });
    res.json({ role: user.role });
  } catch (err) {
    console.error('Login failed:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/validate', async (req, res) => {
  console.log('Validate route called, token:', req.cookies.session_token ? req.cookies.session_token.substring(0, 10) + '...' : 'null');
  const token = req.cookies.session_token;
  const session = token && await getSession(token);
  if (session) {
    console.log('Validate successful for user:', session.username);
    res.json({ valid: true, username: session.username, role: session.role });
  } else {
    console.log('Validate failed');
    res.status(401).json({ valid: false, error: 'Invalid or expired token' });
  }
});

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