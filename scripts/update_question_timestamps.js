const { Questions } = require('../controllers/db.cjs');

async function updateTimestamps() {
    try {
        const questions = await Questions.findAll();
        console.log(`Aktualisiere Timestamps für ${questions.length} Fragen`);

        const now = new Date();
        
        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            
            // Verteile die Fragen über die letzten 7 Tage
            const daysAgo = Math.floor(Math.random() * 7);
            const hoursAgo = Math.floor(Math.random() * 24);
            const minutesAgo = Math.floor(Math.random() * 60);
            
            const newTimestamp = new Date(now);
            newTimestamp.setDate(now.getDate() - daysAgo);
            newTimestamp.setHours(now.getHours() - hoursAgo);
            newTimestamp.setMinutes(now.getMinutes() - minutesAgo);
            
            await question.update({ lastUpdated: newTimestamp });
            
            if (i % 10 === 0) {
                console.log(`Fortschritt: ${i}/${questions.length}`);
            }
        }
        
        console.log('Timestamps aktualisiert!');
        
    } catch (error) {
        console.error('Fehler beim Aktualisieren der Timestamps:', error);
    } finally {
        process.exit();
    }
}

updateTimestamps();