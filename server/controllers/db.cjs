// Dynamically load database driver based on DATABASE_URL
function loadDatabaseDriver() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
    try {
      require('pg');
    } catch (error) {
      console.log('Installing pg...');
      const { execSync } = require('child_process');
      execSync('npm install pg', { stdio: 'inherit' });
      require('pg');
    }
  } else if (databaseUrl.startsWith('mysql://')) {
    try {
      require('mysql2');
    } catch (error) {
      console.log('Installing mysql2...');
      const { execSync } = require('child_process');
      execSync('npm install mysql2', { stdio: 'inherit' });
      require('mysql2');
    }
  }
  // SQLite doesn't need a separate driver as it's built-in
}

loadDatabaseDriver();

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// Model delegates
const User = prisma.users;
const HochschuhlABC = prisma.hochschuhl_abc;
const Questions = prisma.questions;
const Feedback = prisma.feedback;
const Images = prisma.images;
const Documents = prisma.documents;
const AuthSession = prisma.auth_sessions;
const UserSessions = prisma.user_sessions;
const ArticleViews = prisma.article_views;
const ChatInteractions = prisma.chat_interactions;
const Conversation = prisma.conversations;
const Message = prisma.messages;
const QuestionAnalysisCache = prisma.question_analysis_cache;

module.exports = { prisma, User, HochschuhlABC, Questions, Feedback, Images, Documents, AuthSession, UserSessions, ArticleViews, ChatInteractions, Conversation, Message, QuestionAnalysisCache };
