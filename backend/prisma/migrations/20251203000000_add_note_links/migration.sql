-- CreateTable
CREATE TABLE "note_links" (
    "id" TEXT NOT NULL,
    "source_note_id" TEXT NOT NULL,
    "target_keyword" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "note_links_target_keyword_idx" ON "note_links"("target_keyword");

-- CreateIndex
CREATE INDEX "note_links_source_note_id_idx" ON "note_links"("source_note_id");

-- CreateIndex
CREATE UNIQUE INDEX "note_links_source_note_id_target_keyword_key" ON "note_links"("source_note_id", "target_keyword");

-- AddForeignKey
ALTER TABLE "note_links" ADD CONSTRAINT "note_links_source_note_id_fkey" FOREIGN KEY ("source_note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
