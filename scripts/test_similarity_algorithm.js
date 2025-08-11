const { Questions } = require('../controllers/db.cjs');

async function addTestQuestions() {
    try {
        // Füge verschiedene ähnliche Fragen hinzu, die der Algorithmus gruppieren sollte
        const testQuestions = [
            // Bibliotheks-Fragen (sollten gruppiert werden)
            "Wo ist die Bibliothek?",
            "Wie finde ich die Bibliothek?", 
            "Where is the library?",
            "Wo befindet sich die HTW Bibliothek?",
            
            // Prüfungsamt-Fragen (sollten gruppiert werden)
            "Wo ist das Prüfungsamt?",
            "Wie erreiche ich das Prüfungsamt?",
            "Prüfungsamt Kontakt?",
            
            // Parkplatz-Fragen (sollten gruppiert werden)
            "Gibt es Parkplätze an der HTW?",
            "Wo kann ich parken?",
            "Parkplatz HTW Dresden",
            "Wo sind die Stellplätze?",
            
            // Verschiedene einzelne Fragen
            "Wie ist das Wetter heute?",
            "Was kostet das Mittagessen?",
            "Wann öffnet die Mensa morgens?"
        ];
        
        console.log(`Füge ${testQuestions.length} Test-Fragen hinzu...`);
        
        for (const question of testQuestions) {
            await Questions.create({
                question: question,
                answered: Math.random() > 0.5, // Zufällig beantwortet oder nicht
                conversationId: 'test_' + Math.random().toString(36).substring(2, 8),
                lastUpdated: new Date()
            });
        }
        
        console.log('Test-Fragen hinzugefügt!');
        
    } catch (error) {
        console.error('Fehler beim Hinzufügen der Test-Fragen:', error);
    } finally {
        process.exit();
    }
}

addTestQuestions();