const { HochschuhlABC } = require('./db.cjs');

async function getPublishedArticles(req, res) {
    try {
        const { sort } = req.query;
        let order;
        let articles;

        if (sort === 'alpha') {
            // Fetch all and sort in the application for proper locale-aware sorting
            articles = await HochschuhlABC.findMany({
                select: { headline: true, text: true },
                where: {
                    active: true,
                    archived: null
                }
            });

            // German locale, ignore case and accents
            const collator = new Intl.Collator('de', { sensitivity: 'base' });
            articles.sort((a, b) => collator.compare(a.headline, b.headline));
            articles = articles.map(a => ({ headline: a.headline, content: a.text }));

        } else {
            // Default sort by lastUpdated, most recent first
            articles = await HochschuhlABC.findMany({
                select: { headline: true, text: true },
                where: {
                    active: true,
                    archived: null
                },
                orderBy: { lastUpdated: 'desc' }
            });
            articles = articles.map(a => ({ headline: a.headline, content: a.text }));
        }

        res.json(articles);
    } catch (err) {
        console.error("Error fetching published articles:", err.message);
        res.status(500).json({ error: "Failed to retrieve articles" });
    }
}

module.exports = { getPublishedArticles };