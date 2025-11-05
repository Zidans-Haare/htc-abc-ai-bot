-- Create user_profiles table missing from initial deployment
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT,
    "mensa_preferences" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "favorite_prompts" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "shortcuts" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "ui_settings" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL
);

ALTER TABLE "user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");

CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

ALTER TABLE "user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
