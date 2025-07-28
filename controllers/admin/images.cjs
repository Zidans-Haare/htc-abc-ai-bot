const express = require('express');
const { Images } = require('../db.cjs');

module.exports = (authMiddleware) => {
    const router = express.Router();

    router.get('/images', authMiddleware, async (req, res) => {
        try {
            const images = await Images.findAll();
            res.json(images);
        } catch (error) {
            console.error('Fehler beim Abrufen der Bilder:', error);
            res.status(500).send('Serverfehler');
        }
    });

    return router;
};
