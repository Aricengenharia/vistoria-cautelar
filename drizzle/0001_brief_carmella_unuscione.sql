CREATE TABLE `inspections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`sequentialCode` varchar(64) NOT NULL,
	`status` enum('Rascunho','Concluída') NOT NULL DEFAULT 'Rascunho',
	`propertyAddress` varchar(500) NOT NULL,
	`propertyType` varchar(120),
	`payload` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inspections_id` PRIMARY KEY(`id`),
	CONSTRAINT `inspections_sequentialCode_unique` UNIQUE(`sequentialCode`)
);
