-- Add puzzle number column, backfill by ascending date, then enforce NOT NULL + UNIQUE.
ALTER TABLE "puzzle" ADD COLUMN "number" INTEGER;

UPDATE "puzzle"
SET "number" = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY date ASC) AS rn FROM "puzzle"
) sub
WHERE "puzzle".id = sub.id;

ALTER TABLE "puzzle" ALTER COLUMN "number" SET NOT NULL;

CREATE UNIQUE INDEX "puzzle_number_key" ON "puzzle"("number");
