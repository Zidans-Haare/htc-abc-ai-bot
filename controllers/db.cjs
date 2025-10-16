const { PrismaClient } = require('../lib/generated/prisma');

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
