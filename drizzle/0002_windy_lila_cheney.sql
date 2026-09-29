ALTER TABLE `inspections` ADD `publicToken` varchar(96);--> statement-breakpoint
ALTER TABLE `inspections` ADD `publicTokenExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `inspections` ADD CONSTRAINT `inspections_publicToken_unique` UNIQUE(`publicToken`);