-- CreateTable
CREATE TABLE "task_links" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "title" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_links_task_id_idx" ON "task_links"("task_id");

-- AddForeignKey
ALTER TABLE "task_links" ADD CONSTRAINT "task_links_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
