const { HochschuhlABC } = require('./db.cjs');

/**
 * @swagger
 * /api/view/articles:
 *   get:
 *     summary: Veröffentlichte Artikel abrufen
 *     tags: [View]
 *     parameters:
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [alpha, recent]
 *         description: Sortierung (alpha für alphabetisch, recent für nach Aktualisierung)
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset für Paginierung
 *     responses:
 *       200:
 *         description: Liste der Artikel
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   article:
 *                     type: string
 *                   content:
 *                     type: string
 *       500:
 *         description: Serverfehler
 */
async function getPublishedArticles(req, res) {
    try {
        const { sort } = req.query;
        let order;
        let articles;

        const offset = parseInt(req.query.offset) || 0;
        const limit = 100;

        if (sort === 'alpha') {
            // Fetch all and sort in the application for proper locale-aware sorting
            const allArticles = await HochschuhlABC.findMany({
                select: { article: true, description: true },
                where: {
                    active: true,
                    archived: null
                }
            });

            // German locale, ignore case and accents
            const collator = new Intl.Collator('de', { sensitivity: 'base' });
            allArticles.sort((a, b) => collator.compare(a.article, b.article));
            articles = allArticles.slice(offset, offset + limit).map(a => ({ article: a.article, content: a.description }));

        } else {
            // Default sort by updated_at, most recent first
            articles = await HochschuhlABC.findMany({
                select: { article: true, description: true },
                where: {
                    active: true,
                    archived: null
                },
                orderBy: { updated_at: 'desc' },
                take: limit,
                skip: offset
            });
            articles = articles.map(a => ({ article: a.article, content: a.description }));
        }

        res.json(articles);
    } catch (err) {
        console.error("Error fetching published articles:", err.message);
        res.status(500).json({ error: "Failed to retrieve articles" });
    }
}

module.exports = { getPublishedArticles };