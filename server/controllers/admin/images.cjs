const express = require('express');
const multer = require('multer');
const fs = require('fs/promises');
const path = require('path');
const { Images } = require('../db.cjs');

const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads');

// Ensure the upload directory exists
fs.mkdir(uploadDir, { recursive: true }).catch(err => console.error("Failed to create upload directory", err));

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Create a unique filename to avoid overwrites
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

module.exports = (authMiddleware) => {
    const router = express.Router();

    // GET all images
    router.get('/images', authMiddleware, async (req, res) => {
        try {
            const offset = parseInt(req.query.offset) || 0;
            const images = await Images.findMany({
                orderBy: { id: 'desc' },
                take: 100,
                skip: offset
            });
            res.json(images);
        } catch (error) {
            console.error('Fehler beim Abrufen der Bilder:', error);
            res.status(500).send('Serverfehler');
        }
    });

    // POST a new image
    router.post('/images/upload', authMiddleware, upload.single('image'), async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ message: 'Keine Datei hochgeladen.' });
        }

        try {
            // Extract description from the request body
            const { description } = req.body;

            // Save image info to the database
            const newImage = await Images.create({
                data: {
                    filename: req.file.filename,
                    filepath: `/uploads/${req.file.filename}`,
                    description: description || null // Save description, or null if it's empty
                }
            });
            res.status(201).json(newImage);
        } catch (error) {
            console.error('Fehler beim Speichern des Bildes in der DB:', error);
            // If DB write fails, delete the uploaded file
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Fehler beim Löschen der Datei nach DB-Fehler:', unlinkError);
            }
            res.status(500).json({ message: 'Serverfehler beim Speichern der Bildinformationen.' });
        }
    });

    // PUT (update) an image description
    router.put('/images/:filename', authMiddleware, async (req, res) => {
        const { filename } = req.params;
        const { description } = req.body;

        if (typeof description !== 'string') {
            return res.status(400).json({ message: 'Ungültige Beschreibung.' });
        }

        try {
            const updatedImage = await Images.update({
                where: { filename },
                data: { description: description.trim() }
            });

            res.status(200).json(updatedImage);
        } catch (error) {
            console.error(`Fehler beim Aktualisieren der Beschreibung für ${filename}:`, error);
            res.status(500).json({ message: 'Serverfehler beim Aktualisieren der Beschreibung.' });
        }
    });

    // DELETE an image
    router.delete('/images/:filename', authMiddleware, async (req, res) => {
        const { filename } = req.params;
        try {
            // Check if the image exists in the database
            const image = await Images.findUnique({ where: { filename } });
            if (!image) {
                return res.status(404).json({ message: 'Bild nicht in der Datenbank gefunden.' });
            }

            // Delete the file from the filesystem
            const filePath = path.join(uploadDir, filename);
            try {
                await fs.unlink(filePath);
            } catch (fileError) {
                // If the file doesn't exist, we can still proceed to delete the DB entry
                if (fileError.code !== 'ENOENT') {
                    throw fileError;
                }
                console.warn(`Datei nicht gefunden, wird aber aus der DB gelöscht: ${filePath}`);
            }

            // Delete the image from the database
            await Images.delete({ where: { filename } });

            res.status(200).json({ message: 'Bild erfolgreich gelöscht.' });
        } catch (error) {
            console.error(`Fehler beim Löschen des Bildes ${filename}:`, error);
            res.status(500).json({ message: 'Serverfehler beim Löschen des Bildes.' });
        }
    });

    return router;
};