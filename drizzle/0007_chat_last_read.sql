-- Migration 0007: add lastReadAt to group_members for per-user unread chat tracking
ALTER TABLE `group_members` ADD COLUMN `lastReadAt` timestamp;
