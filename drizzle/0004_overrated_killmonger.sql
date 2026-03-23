CREATE INDEX `carpool_rides_groupId_idx` ON `carpool_rides` (`groupId`);--> statement-breakpoint
CREATE INDEX `chat_messages_groupId_idx` ON `chat_messages` (`groupId`);--> statement-breakpoint
CREATE INDEX `chat_messages_senderId_idx` ON `chat_messages` (`senderId`);--> statement-breakpoint
CREATE INDEX `expenses_groupId_idx` ON `expenses` (`groupId`);--> statement-breakpoint
CREATE INDEX `friendships_userId_friendId_idx` ON `friendships` (`userId`,`friendId`);--> statement-breakpoint
CREATE INDEX `group_members_groupId_userId_idx` ON `group_members` (`groupId`,`userId`);--> statement-breakpoint
CREATE INDEX `groups_shareCode_idx` ON `groups` (`shareCode`);--> statement-breakpoint
CREATE INDEX `photos_groupId_idx` ON `photos` (`groupId`);--> statement-breakpoint
CREATE INDEX `polls_groupId_idx` ON `polls` (`groupId`);--> statement-breakpoint
CREATE INDEX `push_tokens_userId_idx` ON `push_tokens` (`userId`);--> statement-breakpoint
CREATE INDEX `shopping_items_groupId_idx` ON `shopping_items` (`groupId`);--> statement-breakpoint
CREATE INDEX `tasks_groupId_idx` ON `tasks` (`groupId`);