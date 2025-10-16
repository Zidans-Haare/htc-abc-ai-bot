const express = require('express');
const multer = require('multer');
const fs = require('fs/promises');
const path = require('path');
const { Documents } = require('../db.cjs');

const uploadDir = path.join(__dirname, '..', '..', 'public', 'documents');

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
        cb(null, 'document-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

module.exports = (authMiddleware) => {
    const router = express.Router();

    // GET all documents
    router.get('/documents', authMiddleware, async (req, res) => {
        try {
            const offset = parseInt(req.query.offset) || 0;
            const documents = await Documents.findMany({
                orderBy: { id: 'desc' },
                take: 100,
                skip: offset
            });
            res.json(documents);
        } catch (error) {
            console.error('Fehler beim Abrufen der Dokumente:', error);
            res.status(500).send('Serverfehler');
        }
    });

    // POST a new document
    router.post('/documents/upload', authMiddleware, upload.single('document'), async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ message: 'Keine Datei hochgeladen.' });
        }

        try {
            // Extract description from the request body
            const { description } = req.body;

            // Determine file type
            const ext = path.extname(req.file.originalname).toLowerCase();
            let fileType;
            if (ext === '.pdf') fileType = 'pdf';
            else if (ext === '.docx') fileType = 'docx';
            else if (ext === '.md') fileType = 'md';
            else if (['.odt', '.ods', '.odp'].includes(ext)) fileType = ext.slice(1);
            else if (ext === '.xlsx') fileType = 'xlsx';
            else {
                // Delete file and return error
                await fs.unlink(req.file.path);
                return res.status(400).json({ message: 'Unsupported file type. Allowed: PDF, DOCX, MD, ODT, ODS, ODP, XLSX.' });
            }

            // Save document info to the database
            const newDocument = await Documents.create({
                data: {
                    filepath: `documents/${req.file.filename}`,
                    file_type: fileType,
                    description: description || null
                }
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

    // PUT (update) a document description
    router.put('/documents/:id', authMiddleware, async (req, res) => {
        const { id } = req.params;
        const { description } = req.body;

        if (typeof description !== 'string') {
            return res.status(400).json({ message: 'Ungültige Beschreibung.' });
        }

        try {
            const updatedDocument = await Documents.update({
                where: { id: parseInt(id) },
                data: { description: description.trim() }
            });

            res.status(200).json(updatedDocument);
        } catch (error) {
            console.error(`Fehler beim Aktualisieren der Beschreibung für Dokument ${id}:`, error);
            res.status(500).json({ message: 'Serverfehler beim Aktualisieren der Beschreibung.' });
        }
    });

    // DELETE a document
    router.delete('/documents/:id', authMiddleware, async (req, res) => {
        const { id } = req.params;
        try {
            // Check if the document exists in the database
            const document = await Documents.findUnique({ where: { id: parseInt(id) } });
            if (!document) {
                return res.status(404).json({ message: 'Dokument nicht in der Datenbank gefunden.' });
            }

            // Delete the file from the filesystem
            const filePath = path.join(__dirname, '..', '..', 'public', document.filepath);
            try {
                await fs.unlink(filePath);
            } catch (fileError) {
                // If the file doesn't exist, we can still proceed to delete the DB entry
                if (fileError.code !== 'ENOENT') {
                    throw fileError;
                }
                console.warn(`Datei nicht gefunden, wird aber aus der DB gelöscht: ${filePath}`);
            }

            // Delete the document from the database
            await Documents.delete({ where: { id: parseInt(id) } });

            res.status(200).json({ message: 'Dokument erfolgreich gelöscht.' });
        } catch (error) {
            console.error(`Fehler beim Löschen des Dokuments ${id}:`, error);
            res.status(500).json({ message: 'Serverfehler beim Löschen des Dokuments.' });
        }
    });

    return router;
};