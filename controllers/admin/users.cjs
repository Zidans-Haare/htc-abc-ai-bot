const express = require('express');
const router = express.Router();

module.exports = (adminAuth) => {
  router.get('/users', adminAuth, async (req, res) => {
    if (req.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    const auth = require('../authController.cjs');
    const users = await auth.listUsers();
    res.json(users);
  });

  router.post('/users', adminAuth, async (req, res) => {
    if (req.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    const { username, password, role } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'missing' });
    try {
      const auth = require('../authController.cjs');
      const user = await auth.createUser(username, password, role || 'editor');
      res.status(201).json({ id: user.id, username: user.username, role: user.role });
    } catch (err) {
      console.error('Failed to create user', err);
      res.status(500).json({ error: 'failed' });
    }
  });

  router.put('/users/:username/password', adminAuth, async (req, res) => {
    if (req.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    const { username } = req.params;
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'missing password' });
    try {
      const auth = require('../authController.cjs');
      await auth.updateUserPassword(username, password);
      res.json({ success: true });
    } catch (err) {
      console.error(`Failed to update password for ${username}`, err);
      res.status(500).json({ error: 'failed' });
    }
  });

  router.delete('/users/:username', adminAuth, async (req, res) => {
    if (req.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    const { username } = req.params;
    if (req.user === username) {
        return res.status(400).json({ error: 'cannot delete self' });
    }
    try {
      const auth = require('../authController.cjs');
      await auth.deleteUser(username);
      res.json({ success: true });
    } catch (err) {
      console.error(`Failed to delete user ${username}`, err);
      res.status(500).json({ error: 'failed' });
    }
  });

  return router;
};
