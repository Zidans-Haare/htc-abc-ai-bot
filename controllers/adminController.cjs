const express = require('express');
const router = express.Router();

// Admin auth middleware factory
const adminAuth = (getSession, logAction) => (req, res, next) => {
  const token = req.cookies.sessionToken;
  const session = token && getSession(token);
  if (session) {
    req.user = session.username;
    req.role = session.role;
    logAction(session.username, `${req.method} ${req.originalUrl}`);
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
};

// Factory function to create router with dependencies
module.exports = (getSession, logAction) => {
  const authMiddleware = adminAuth(getSession, logAction);

  const adminRouter = express.Router();

  adminRouter.use(require('./admin/questions.cjs')(authMiddleware));
  adminRouter.use(require('./admin/headlines.cjs')(authMiddleware));
  adminRouter.use(require('./admin/archive.cjs')(authMiddleware));
  adminRouter.use(require('./admin/users.cjs')(authMiddleware));
  adminRouter.use(require('./admin/export.cjs')(authMiddleware));
  adminRouter.use(require('./admin/stats.cjs')(authMiddleware));
  adminRouter.use(require('./admin/feedback.cjs')(authMiddleware));

  router.use('/admin', adminRouter);

  return router;
};
