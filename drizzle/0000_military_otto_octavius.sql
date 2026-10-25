CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`space` text NOT NULL,
	`kind` text NOT NULL,
	`owner` text NOT NULL,
	`body` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `records_space_kind` ON `records` (`space`,`kind`);--> statement-breakpoint
CREATE INDEX `records_owner` ON `records` (`space`,`owner`);