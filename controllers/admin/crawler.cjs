const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const router = express.Router();

// This should be in a .env file in a real application
const CRAWLER_PASSWORD = '-cliforthewin657-';

// POST /api/admin/crawler/run
// Runs the import_crawled_data.py script
router.post('/run', (req, res) => {
    const { password } = req.body;

    if (password !== CRAWLER_PASSWORD) {
        return res.status(401).json({ message: 'Falsches Passwort.' });
    }

    const scriptPath = path.join(__dirname, '../../scripts/import_crawled_data.py');
    
    console.log(`[Crawler] Starting import_crawled_data.py script...`);

    const pythonProcess = spawn('python', [scriptPath]);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log(`[Importer stdout]: ${data.toString()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error(`[Importer stderr]: ${data.toString()}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`[Importer] Script finished with exit code ${code}`);
        if (code === 0) {
            res.status(200).json({ 
                message: 'Import-Prozess erfolgreich abgeschlossen.',
                output: stdout
            });
        } else {
            res.status(500).json({ 
                message: 'Fehler beim Ausführen des Import-Prozesses.',
                error: stderr 
            });
        }
    });

    pythonProcess.on('error', (err) => {
        console.error('[Importer] Failed to start subprocess.', err);
        res.status(500).json({ message: 'Interner Serverfehler: Importer konnte nicht gestartet werden.' });
    });
});

module.exports = router;
