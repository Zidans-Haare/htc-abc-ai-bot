const { PrismaClient } = require('../lib/generated/prisma');

const prisma = new PrismaClient();

async function inspectQuestions() {
  try {
    const questions = await prisma.questions.findMany();
    console.log('Total questions:', questions.length);

    for (const q of questions) {
      try {
        // Check if strings are valid
        if (q.question && !isValidUTF8(q.question)) {
          console.log('Invalid question:', q.id, q.question);
        }
        if (q.answer && !isValidUTF8(q.answer)) {
          console.log('Invalid answer:', q.id, q.answer);
        }
        if (q.user && !isValidUTF8(q.user)) {
          console.log('Invalid user:', q.id, q.user);
        }
        if (q.translation && !isValidUTF8(q.translation)) {
          console.log('Invalid translation:', q.id, q.translation);
        }
        if (q.feedback && !isValidUTF8(q.feedback)) {
          console.log('Invalid feedback:', q.id, q.feedback);
        }
      } catch (err) {
        console.log('Error checking question', q.id, err.message);
      }
    }
  } catch (err) {
    console.error('Error fetching questions:', err);
  } finally {
    await prisma.$disconnect();
  }
}

function isValidUTF8(str) {
  try {
    // Try to encode and decode
    return Buffer.from(str, 'utf8').toString('utf8') === str;
  } catch {
    return false;
  }
}

inspectQuestions();