const express = require('express');
const { Conversation, Message } = require('../../controllers/db.cjs');

const router = express.Router();

// This middleware will be applied by the main admin controller
// So we don't need to add it here.

// GET /api/admin/conversations - List all conversations
router.get('/', async (req, res) => {
  try {
    const conversations = await Conversation.findAll({
      attributes: ['id', 'anonymous_user_id', 'created_at', 'category', 'ai_confidence'],
      order: [['created_at', 'DESC']],
      limit: 100, // Limit to the last 100 conversations for performance
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
    const messages = await Message.findAll({
      where: { conversation_id: conversationId },
      order: [['created_at', 'ASC']],
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