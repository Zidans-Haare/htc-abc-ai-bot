const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User } = require('./db.cjs');

const SESSION_TTL = 1000 * 60 * 60; // 1 hour
const sessions = {};

function createSession(username, role) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = { username, role, created: Date.now(), expires: Date.now() + SESSION_TTL };
  console.log('Created session:', { token, username, role, expires: new Date(sessions[token].expires).toISOString() });
  return token;
}

function destroySession(token) {
  console.log('Destroying session:', token);
  delete sessions[token];
}

function getSession(token) {
  const s = sessions[token];
  if (!s) {
    console.log('Session not found for token:', token);
    return null;
  }
  if (Date.now() > s.expires) {
    console.log('Session expired for token:', token);
    delete sessions[token];
    return null;
  }
  // --- Sliding Session Logic ---
  // Extend the session's lifetime on every valid request.
  s.expires = Date.now() + SESSION_TTL;
  sessions[token] = s; // Update the session in the store
  // --- End of Sliding Session Logic ---

  console.log('Session retrieved and refreshed:', { token, username: s.username, role: s.role, new_expires: new Date(s.expires).toISOString() });
  return s;
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
    const token = createSession(user.username, user.role);
    // secure: true should be used in production when using HTTPS
    const secureCookie = req.app.get('env') === 'production';
    res.cookie('sessionToken', token, {
      httpOnly: true,
      secure: secureCookie,
      maxAge: SESSION_TTL,
      sameSite: 'strict'
    });
    res.json({ role: user.role });
  } catch (err) {
    console.error('Login failed:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/validate', (req, res) => {
  const token = req.cookies.sessionToken;
  const session = token && getSession(token);
  if (session) {
    res.json({ valid: true, username: session.username, role: session.role });
  } else {
    res.status(401).json({ valid: false, error: 'Invalid or expired token' });
  }
});

router.post('/logout', (req, res) => {
  const token = req.cookies.sessionToken;
  if (token) {
    destroySession(token);
  }
  res.clearCookie('sessionToken');
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
    SESSION_TTL
};