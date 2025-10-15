const express = require('express');
const { Conversation, Message } = require('../../controllers/db.cjs');

const router = express.Router();

// This middleware will be applied by the main admin controller
// So we don't need to add it here.

// GET /api/admin/conversations - List all conversations
router.get('/', async (req, res) => {
  try {
    const offset = parseInt(req.query.offset) || 0;
    const conversations = await Conversation.findMany({
      select: { id: true, anonymous_user_id: true, created_at: true, category: true, ai_confidence: true },
      orderBy: { created_at: 'desc' },
      take: 100,
      skip: offset
    });
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations.' });
  }
});

// GET /api/admin/conversations/:id - Get a single conversation with all its messages
router.get('/:id', async (req, res) => {
  try {
    const conversationId = req.params.id;
    const messages = await Message.findMany({
      where: { conversation_id: conversationId },
      orderBy: { created_at: 'asc' },
    });

    if (!messages || messages.length === 0) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    res.json(messages);
  } catch (error) {
    console.error(`Error fetching messages for conversation ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

module.exports = router;