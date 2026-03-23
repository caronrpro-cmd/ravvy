-- Drop the old composite index (replaced by two separate indexes + functional unique)
DROP INDEX `friendships_userId_friendId_idx` ON `friendships`;
--> statement-breakpoint

-- Index for lookups by initiator (userId)
CREATE INDEX `friendships_userId_idx` ON `friendships` (`userId`);
--> statement-breakpoint

-- Index for lookups by recipient (friendId)
CREATE INDEX `friendships_friendId_idx` ON `friendships` (`friendId`);
--> statement-breakpoint

-- Canonical unique constraint: prevents (A→B) and (B→A) from both existing.
-- LEAST/GREATEST normalises the pair so (1,2) and (2,1) map to the same key.
CREATE UNIQUE INDEX `friendships_canonical_uniq` ON `friendships` ((LEAST(`userId`, `friendId`)), (GREATEST(`userId`, `friendId`)));
