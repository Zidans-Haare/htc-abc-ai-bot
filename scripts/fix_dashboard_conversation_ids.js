const { Questions } = require('../controllers/db.cjs');
const { v4: uuidv4 } = require('crypto');

function generateConversationId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

async function fixConversationIds() {
    try {
        // Alle Fragen ohne conversationId finden
        const questionsWithoutId = await Questions.findAll({
            where: { conversationId: null }
        });

        console.log(`Gefunden: ${questionsWithoutId.length} Fragen ohne conversationId`);

        // Gruppen von 3-5 Fragen pro "Session" erstellen
        let currentConversationId = null;
        let questionsInCurrentConversation = 0;
        const maxQuestionsPerConversation = 3 + Math.floor(Math.random() * 3); // 3-5 Fragen

        for (let i = 0; i < questionsWithoutId.length; i++) {
            const question = questionsWithoutId[i];
            
            // Neue conversation ID erstellen wenn nötig
            if (!currentConversationId || questionsInCurrentConversation >= maxQuestionsPerConversation) {
                currentConversationId = generateConversationId();
                questionsInCurrentConversation = 0;
            }

            await question.update({ conversationId: currentConversationId });
            questionsInCurrentConversation++;

            if (i % 10 === 0) {
                console.log(`Fortschritt: ${i}/${questionsWithoutId.length}`);
            }
        }

        console.log('Dashboard ConversationId Fix abgeschlossen!');
        
        // Statistik anzeigen
        const totalSessions = await Questions.count({ 
            where: { conversationId: { [require('sequelize').Op.ne]: null } }, 
            distinct: true, 
            col: 'conversationId' 
        });
        
        console.log(`Insgesamt ${totalSessions} Sessions erstellt`);
        
    } catch (error) {
        console.error('Fehler beim Reparieren der conversationIds:', error);
    } finally {
        process.exit();
    }
}

fixConversationIds();