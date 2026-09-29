ALTER TABLE `inspections` MODIFY COLUMN `status` enum('Rascunho','Concluída','Em elaboração','Concluído','Conferido','Aprovado') NOT NULL DEFAULT 'Em elaboração';
UPDATE `inspections`
SET `status` = CASE
  WHEN `status` = 'Rascunho' THEN 'Em elaboração'
  WHEN `status` = 'Concluída' THEN 'Concluído'
  ELSE `status`
END;
ALTER TABLE `inspections` MODIFY COLUMN `status` enum('Em elaboração','Concluído','Conferido','Aprovado') NOT NULL DEFAULT 'Em elaboração';
