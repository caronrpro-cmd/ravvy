CREATE TABLE `carpool_rides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(64) NOT NULL,
	`groupId` int NOT NULL,
	`driverName` varchar(128) NOT NULL,
	`driverId` varchar(128) NOT NULL,
	`departure` varchar(255),
	`departureTime` varchar(32),
	`totalSeats` int DEFAULT 4,
	`availableSeats` int DEFAULT 3,
	`passengers` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `carpool_rides_id` PRIMARY KEY(`id`),
	CONSTRAINT `carpool_rides_externalId_unique` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(64) NOT NULL,
	`groupId` int NOT NULL,
	`senderId` int NOT NULL,
	`text` text,
	`msgType` enum('text','image','location') NOT NULL DEFAULT 'text',
	`imageUrl` text,
	`isPinned` boolean NOT NULL DEFAULT false,
	`reactions` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `chat_messages_externalId_unique` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(64) NOT NULL,
	`groupId` int NOT NULL,
	`description` varchar(255) NOT NULL,
	`amount` varchar(16) NOT NULL,
	`paidBy` varchar(128) NOT NULL,
	`paidByName` varchar(128),
	`splitBetween` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`),
	CONSTRAINT `expenses_externalId_unique` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE TABLE `friendships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`friendId` int NOT NULL,
	`friendStatus` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `friendships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `group_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`userId` int NOT NULL,
	`rsvp` enum('present','absent','maybe','pending') NOT NULL DEFAULT 'pending',
	`memberRole` enum('admin','member') NOT NULL DEFAULT 'member',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `group_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`groupType` enum('classic','auto-destruct') NOT NULL DEFAULT 'classic',
	`coverImage` text,
	`date` varchar(32),
	`time` varchar(16),
	`location` text,
	`shareCode` varchar(16),
	`template` varchar(32),
	`createdBy` int NOT NULL,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `groups_externalId_unique` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(64) NOT NULL,
	`groupId` int NOT NULL,
	`uri` text NOT NULL,
	`uploadedBy` varchar(128),
	`uploadedByName` varchar(128),
	`caption` text,
	`likes` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `photos_id` PRIMARY KEY(`id`),
	CONSTRAINT `photos_externalId_unique` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE TABLE `polls` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(64) NOT NULL,
	`groupId` int NOT NULL,
	`question` varchar(500) NOT NULL,
	`options` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `polls_id` PRIMARY KEY(`id`),
	CONSTRAINT `polls_externalId_unique` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE TABLE `push_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(512) NOT NULL,
	`platform` varchar(16),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `push_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shopping_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(64) NOT NULL,
	`groupId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`quantity` int DEFAULT 1,
	`price` varchar(16),
	`assignedTo` varchar(128),
	`assignedToName` varchar(128),
	`checked` boolean NOT NULL DEFAULT false,
	`addedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shopping_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `shopping_items_externalId_unique` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(64) NOT NULL,
	`groupId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`assignedTo` varchar(128),
	`assignedToName` varchar(128),
	`priority` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`completed` boolean NOT NULL DEFAULT false,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `tasks_externalId_unique` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`username` varchar(64),
	`bio` text,
	`avatar` text,
	`status` varchar(20) DEFAULT 'available',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
