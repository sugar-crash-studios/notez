-- AddTaskSortIndexes
-- Adds indexes for common task sort operations

-- Index for sorting by priority
CREATE INDEX IF NOT EXISTS "tasks_user_id_priority_idx" ON "tasks"("user_id", "priority");

-- Index for sorting by created date
CREATE INDEX IF NOT EXISTS "tasks_user_id_created_at_idx" ON "tasks"("user_id", "created_at");
