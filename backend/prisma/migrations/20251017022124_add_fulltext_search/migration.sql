-- AlterTable
ALTER TABLE "notes" ADD COLUMN     "search_vector" tsvector;

-- CreateIndex
CREATE INDEX "notes_search_vector_idx" ON "notes" USING GIN ("search_vector");

-- Create function to update search_vector
CREATE OR REPLACE FUNCTION notes_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search_vector on INSERT or UPDATE
CREATE TRIGGER notes_search_vector_trigger
BEFORE INSERT OR UPDATE ON notes
FOR EACH ROW
EXECUTE FUNCTION notes_search_vector_update();

-- Update existing notes with search vectors
UPDATE notes SET search_vector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(content, '')), 'B');
