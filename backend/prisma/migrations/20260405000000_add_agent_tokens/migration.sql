-- Agent token fields on api_tokens
ALTER TABLE "api_tokens" ADD COLUMN "is_agent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "api_tokens" ADD COLUMN "agent_name" VARCHAR(50);
ALTER TABLE "api_tokens" ADD COLUMN "agent_icon" VARCHAR(50);
ALTER TABLE "api_tokens" ADD COLUMN "agent_color" VARCHAR(7);

-- Content attribution: createdByTokenId FK on content models
ALTER TABLE "notes" ADD COLUMN "created_by_token_id" TEXT;
ALTER TABLE "folders" ADD COLUMN "created_by_token_id" TEXT;
ALTER TABLE "tags" ADD COLUMN "created_by_token_id" TEXT;
ALTER TABLE "tasks" ADD COLUMN "created_by_token_id" TEXT;

-- Foreign keys (SetNull on delete so content survives token revocation/deletion)
ALTER TABLE "notes" ADD CONSTRAINT "notes_created_by_token_id_fkey" FOREIGN KEY ("created_by_token_id") REFERENCES "api_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "folders" ADD CONSTRAINT "folders_created_by_token_id_fkey" FOREIGN KEY ("created_by_token_id") REFERENCES "api_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tags" ADD CONSTRAINT "tags_created_by_token_id_fkey" FOREIGN KEY ("created_by_token_id") REFERENCES "api_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_token_id_fkey" FOREIGN KEY ("created_by_token_id") REFERENCES "api_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes for querying agent-created content
CREATE INDEX "notes_created_by_token_id_idx" ON "notes"("created_by_token_id");
CREATE INDEX "folders_created_by_token_id_idx" ON "folders"("created_by_token_id");
CREATE INDEX "tags_created_by_token_id_idx" ON "tags"("created_by_token_id");
CREATE INDEX "tasks_created_by_token_id_idx" ON "tasks"("created_by_token_id");

-- Index for listing agent tokens per user
CREATE INDEX "api_tokens_user_id_is_agent_idx" ON "api_tokens"("user_id", "is_agent");
