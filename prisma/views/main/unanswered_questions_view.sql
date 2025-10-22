SELECT
  m.content,
  m.created_at,
  c.category
FROM
  messages AS m
  JOIN conversations AS c ON m.conversation_id = c.id
  LEFT JOIN messages AS m_response ON m_response.conversation_id = c.id
  AND m_response.role = 'model'
  AND m_response.created_at > m.created_at
  AND ABS(
    strftime('%s', m_response.created_at) - strftime('%s', m.created_at)
  ) < 30
WHERE
  m.role = 'user'
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
  AND m.created_at >= datetime('now', '-7 days');