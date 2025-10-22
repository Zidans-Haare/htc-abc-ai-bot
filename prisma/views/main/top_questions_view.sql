SELECT
  normalized_question AS question,
  SUM(question_count) AS count,
  0 AS answered_count,
  SUM(question_count) AS unanswered_count,
  GROUP_CONCAT(DISTINCT original_questions) AS similar_questions
FROM
  daily_question_stats
GROUP BY
  normalized_question
ORDER BY
  count DESC;