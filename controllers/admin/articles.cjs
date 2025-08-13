const express = require('express');
const { Articles } = require('../db.cjs');
const router = express.Router();

module.exports = (authMiddleware) => {
    // GET /api/admin/articles/crawled
    // Gets all articles that have been imported by the crawler
    router.get('/articles/crawled', authMiddleware, async (req, res) => {
        try {
            const articles = await Articles.findAll({
                where: {
                    status: 'crawled'
                },
                order: [['lastUpdated', 'DESC']]
            });
            res.json(articles);
        } catch (error) {
            console.error('Error fetching crawled articles:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // GET /api/admin/articles/:id
    // Gets a single article by its ID
    router.get('/articles/:id', authMiddleware, async (req, res) => {
        try {
            const articleId = req.params.id;
            const article = await Articles.findByPk(articleId);

            if (article) {
                res.json(article);
            } else {
                res.status(404).json({ error: 'Article not found' });
            }
        } catch (error) {
            console.error('Error fetching article by ID:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    return router;
};
