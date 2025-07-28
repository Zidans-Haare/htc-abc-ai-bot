const express = require('express');
const { Bilder } = require('../db.cjs');

module.exports = (authMiddleware) => {
    const router = express.Router();

    router.get('/images', authMiddleware, async (req, res) => {
        try {
            const bilder = await Bilder.findAll();
            res.json(bilder);
        } catch (error) {
            console.error('Fehler beim Abrufen der Bilder:', error);
            res.status(500).send('Serverfehler');
        }
    });

    return router;
};
