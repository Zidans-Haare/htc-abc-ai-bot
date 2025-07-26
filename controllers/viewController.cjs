const { HochschuhlABC } = require('./db.cjs');
const { Op } = require('sequelize');

async function getPublishedArticles(req, res) {
    try {
        const articles = await HochschuhlABC.findAll({
            attributes: ['headline', ['text', 'content']],
            where: {
                archived: {
                    [Op.is]: null
                }
            },
            order: [
                ['headline', 'DESC']
            ]
        });
        res.json(articles);
    } catch (err) {
        console.error("Error fetching published articles:", err.message);
        res.status(500).json({ error: "Failed to retrieve articles" });
    }
}

module.exports = { getPublishedArticles };