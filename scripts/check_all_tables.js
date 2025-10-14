const { PrismaClient } = require('../lib/generated/prisma');

const prisma = new PrismaClient();

const tables = [
  'article_views',
  'auth_sessions',
  'chat_interactions',
  'conversations',
  'daily_question_stats',
  'feedback',
  'hochschuhl_abc',
  'images',
  'messages',
  'page_views',
  'pdfs',
  'question_analysis_cache',
  'question_cache',
  'questions',
  'sessions',
  'token_usage',
  'user_sessions',
  'users'
];

async function checkTable(table) {
  try {
    const data = await prisma[table].findMany();
    console.log(`${table}: ${data.length} rows, OK`);
  } catch (err) {
    console.log(`${table}: ERROR - ${err.message}`);
  }
}

async function checkAll() {
  for (const table of tables) {
    await checkTable(table);
  }
  await prisma.$disconnect();
}

checkAll();