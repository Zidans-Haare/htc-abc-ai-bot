-- CreateTable
CREATE TABLE "article_views" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "article_id" INTEGER NOT NULL,
    "user_id" TEXT,
    "viewed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "question_context" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "article_views_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "hochschuhl_abc" ("id") ON DELETE NO ACTION ON UPDATE CASCADE,
    CONSTRAINT "article_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "chat_interactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "session_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "was_successful" BOOLEAN DEFAULT false,
    "response_time_ms" INTEGER,
    "tokens_used" INTEGER,
    "timestamp" DATETIME,
    "error_message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "chat_interactions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "user_sessions" ("session_id") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "anonymous_user_id" TEXT NOT NULL,
    "category" TEXT DEFAULT 'Unkategorisiert',
    "ai_confidence" REAL,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "daily_question_stats" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "analysis_date" TEXT NOT NULL,
    "normalized_question" TEXT NOT NULL,
    "question_count" INTEGER NOT NULL,
    "topic" TEXT,
    "languages_detected" TEXT,
    "original_questions" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "daily_unanswered_stats" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "analysis_date" TEXT NOT NULL,
    "normalized_question" TEXT NOT NULL,
    "question_count" INTEGER NOT NULL,
    "topic" TEXT,
    "languages_detected" TEXT,
    "original_questions" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" TEXT,
    "text" TEXT NOT NULL,
    "email" TEXT,
    "rating" INTEGER,
    "conversation_id" TEXT,
    "attached_chat_history" TEXT,
    "submitted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "hochschuhl_abc" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "article" TEXT NOT NULL,
    "description" TEXT,
    "editor" TEXT,
    "active" BOOLEAN DEFAULT true,
    "archived" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "images" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "filename" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "messages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "page_views" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT NOT NULL DEFAULT '/',
    "timestamp" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "question_analysis_cache" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cache_key" TEXT NOT NULL,
    "normalized_question" TEXT NOT NULL,
    "question_count" INTEGER DEFAULT 1,
    "topic" TEXT,
    "languages_detected" TEXT,
    "original_questions" TEXT NOT NULL,
    "is_processing" BOOLEAN DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "questions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "user" TEXT,
    "category_id" INTEGER,
    "archived" BOOLEAN DEFAULT false,
    "linked_article_id" INTEGER,
    "answered" BOOLEAN DEFAULT false,
    "spam" BOOLEAN DEFAULT false,
    "deleted" BOOLEAN DEFAULT false,
    "translation" TEXT,
    "feedback" TEXT,
    "answered_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "questions_linked_article_id_fkey" FOREIGN KEY ("linked_article_id") REFERENCES "hochschuhl_abc" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "token_usage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token_count" INTEGER NOT NULL,
    "timestamp" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "session_id" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "started_at" DATETIME,
    "last_activity" DATETIME,
    "questions_count" INTEGER DEFAULT 0,
    "successful_answers" INTEGER DEFAULT 0,
    "ended_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'editor',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "documents" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "article_id" INTEGER,
    "filepath" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "description" TEXT,
    "uploaded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "documents_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "hochschuhl_abc" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_key" ON "auth_sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "images_filename_key" ON "images"("filename");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_session_id_key" ON "user_sessions"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateView
CREATE VIEW top_questions_view AS
SELECT
    normalized_question AS question,
    SUM(question_count) AS count,
    SUM(CASE WHEN answered = 1 THEN question_count ELSE 0 END) AS answered_count,
    SUM(CASE WHEN answered = 0 THEN question_count ELSE 0 END) AS unanswered_count,
    GROUP_CONCAT(DISTINCT original_questions) AS similar_questions
FROM daily_question_stats
GROUP BY normalized_question
ORDER BY count DESC;

-- CreateView
CREATE VIEW unanswered_questions_view AS
SELECT
    m.content,
    m.created_at,
    c.category
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
LEFT JOIN messages m_response ON m_response.conversation_id = c.id
    AND m_response.role = 'model'
    AND m_response.created_at > m.created_at
    AND ABS(strftime('%s', m_response.created_at) - strftime('%s', m.created_at)) < 30
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
AND m.created_at >= datetime('now', '-7 days');