// Raw SQL queries for MySQL
module.exports = {
  get_top_questions: () => `
    SELECT
        normalized_question AS question,
        SUM(question_count) AS count,
        0 AS answered_count,
        SUM(question_count) AS unanswered_count,
        GROUP_CONCAT(DISTINCT original_questions) AS similar_questions
    FROM daily_question_stats
    GROUP BY normalized_question
    ORDER BY count DESC
    LIMIT 5
  `,

  get_unanswered_questions: () => `
    SELECT
        m.content,
        m.created_at,
        c.category
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    LEFT JOIN messages m_response ON m_response.conversation_id = c.id
        AND m_response.role = 'model'
        AND m_response.created_at > m.created_at
        AND TIMESTAMPDIFF(SECOND, m.created_at, m_response.created_at) < 30
    WHERE m.role = 'user'
    AND LENGTH(TRIM(m.content)) > 5
    AND m.content NOT LIKE '%<%'
    AND (
        m_response.content IS NULL
        OR m_response.content LIKE '%kann ich leider nicht%'
        OR m_response.content LIKE '%keine Informationen%'
        OR m_response.content LIKE '%tut mir leid%'
        OR m_response.content LIKE '%sorry%'
        OR m_response.content LIKE '%Unfortunately%'
        OR LENGTH(m_response.content) < 50
    )
    AND m.created_at >= NOW() - INTERVAL 7 DAY
    ORDER BY m.created_at DESC
    LIMIT 200
  `
};