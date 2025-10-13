const express = require('express');
const multer = require('multer');
const fs = require('fs/promises');
const path = require('path');
const { PDFs } = require('../db.cjs');

const uploadDir = path.join(__dirname, '..', '..', 'public', 'pdf');

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

    // GET all PDFs
    router.get('/pdfs', authMiddleware, async (req, res) => {
        try {
            const pdfs = await PDFs.findAll({
                order: [['id', 'DESC']]
            });
            res.json(pdfs);
        } catch (error) {
            console.error('Fehler beim Abrufen der PDFs:', error);
            res.status(500).send('Serverfehler');
        }
    });

    // POST a new PDF
    router.post('/pdfs/upload', authMiddleware, upload.single('pdf'), async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ message: 'Keine Datei hochgeladen.' });
        }

        try {
            // Extract description from the request body
            const { description } = req.body;

            // Save PDF info to the database
            const newPDF = await PDFs.create({
                filename: req.file.filename,
                filepath: `/pdf/${req.file.filename}`,
                description: description || null // Save description, or null if it's empty
            });
            res.status(201).json(newPDF);
        } catch (error) {
            console.error('Fehler beim Speichern des PDFs in der DB:', error);
            // If DB write fails, delete the uploaded file
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Fehler beim Löschen der Datei nach DB-Fehler:', unlinkError);
            }
            res.status(500).json({ message: 'Serverfehler beim Speichern der PDF-Informationen.' });
        }
    });

    // PUT (update) a PDF description
    router.put('/pdfs/:filename', authMiddleware, async (req, res) => {
        const { filename } = req.params;
        const { description } = req.body;

        if (typeof description !== 'string') {
            return res.status(400).json({ message: 'Ungültige Beschreibung.' });
        }

        try {
            const pdf = await PDFs.findOne({ where: { filename } });

            if (!pdf) {
                return res.status(404).json({ message: 'PDF nicht gefunden.' });
            }

            pdf.description = description.trim();
            await pdf.save();

            res.status(200).json(pdf);
        } catch (error) {
            console.error(`Fehler beim Aktualisieren der Beschreibung für ${filename}:`, error);
            res.status(500).json({ message: 'Serverfehler beim Aktualisieren der Beschreibung.' });
        }
    });

    // DELETE a PDF
    router.delete('/pdfs/:filename', authMiddleware, async (req, res) => {
        const { filename } = req.params;
        try {
            // Find the PDF in the database
            const pdf = await PDFs.findOne({ where: { filename } });
            if (!pdf) {
                return res.status(404).json({ message: 'PDF nicht in der Datenbank gefunden.' });
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

            // Delete the PDF from the database
            await pdf.destroy();

            res.status(200).json({ message: 'PDF erfolgreich gelöscht.' });
        } catch (error) {
            console.error(`Fehler beim Löschen des PDFs ${filename}:`, error);
            res.status(500).json({ message: 'Serverfehler beim Löschen des PDFs.' });
        }
    });

    return router;
};