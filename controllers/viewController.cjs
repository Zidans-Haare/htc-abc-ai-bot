const { HochschuhlABC } = require('./db.cjs');
const { Op } = require('sequelize');

async function getPublishedArticles(req, res) {
    try {
        const { sort } = req.query;
        let order;
        let articles;

        if (sort === 'alpha') {
            // Fetch all and sort in the application for proper locale-aware sorting
            articles = await HochschuhlABC.findAll({
                attributes: ['headline', ['text', 'content']],
                where: {
                    active: true,
                    archived: {
                        [Op.is]: null
                    }
                }
            });

            // German locale, ignore case and accents
            const collator = new Intl.Collator('de', { sensitivity: 'base' });
            articles.sort((a, b) => collator.compare(a.headline, b.headline));

        } else {
            // Default sort by lastUpdated, most recent first
            order = [['lastUpdated', 'DESC']];
            articles = await HochschuhlABC.findAll({
                attributes: ['headline', ['text', 'content']],
                where: {
                    active: true,
                    archived: {
                        [Op.is]: null
                    }
                },
                order: order
            });
        }

        res.json(articles);
    } catch (err) {
        console.error("Error fetching published articles:", err.message);
        res.status(500).json({ error: "Failed to retrieve articles" });
    }
}

module.exports = { getPublishedArticles };