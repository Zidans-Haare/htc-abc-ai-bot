const express = require('express');
const router = express.Router();
const { Feedback } = require('./db.cjs');

router.post('/', async (req, res) => {
    const { feedback_text, email, conversation_id, captcha, expected_captcha } = req.body;

    if (!captcha || !expected_captcha || parseInt(captcha, 10) !== expected_captcha) {
        return res.status(400).json({ message: 'Captcha-Validierung fehlgeschlagen.' });
    }

    console.log(`Received feedback: ${feedback_text}`);

    try {
        await Feedback.create({ 
            feedback_text: feedback_text,
            email: email,
            conversation_id: conversation_id
        });
        res.sendStatus(200);
    } catch (err) {
        console.error(err.message);
        res.status(500).send(err.message);
    }
});

module.exports = router;
