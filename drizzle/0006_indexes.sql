-- Add createdBy index to groups
CREATE INDEX `groups_createdBy_idx` ON `groups` (`createdBy`);
--> statement-breakpoint
-- Replace non-unique index on group_members with a unique constraint
DROP INDEX `group_members_groupId_userId_idx` ON `group_members`;
--> statement-breakpoint
CREATE UNIQUE INDEX `group_members_groupId_userId_uniq` ON `group_members` (`groupId`, `userId`);
--> statement-breakpoint
-- Add createdAt index to chat_messages for paginated queries
CREATE INDEX `chat_messages_createdAt_idx` ON `chat_messages` (`createdAt`);
