-- Root-level items have a NULL parent (folders) or NULL folder (files).
-- Postgres treats NULLs as distinct by default, which would let two "Legal"
-- folders exist side by side at the root. NULLS NOT DISTINCT closes that gap
-- so the database — not just the service layer — enforces unique names.
DROP INDEX "Folder_dataRoomId_parentFolderId_name_key";
CREATE UNIQUE INDEX "Folder_dataRoomId_parentFolderId_name_key"
  ON "Folder" ("dataRoomId", "parentFolderId", "name") NULLS NOT DISTINCT;

DROP INDEX "File_dataRoomId_folderId_name_key";
CREATE UNIQUE INDEX "File_dataRoomId_folderId_name_key"
  ON "File" ("dataRoomId", "folderId", "name") NULLS NOT DISTINCT;
