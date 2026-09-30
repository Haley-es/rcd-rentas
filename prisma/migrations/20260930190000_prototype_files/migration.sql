BEGIN TRY
BEGIN TRAN;
CREATE TABLE [dbo].[PrototypeFile] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [stateId] INT NOT NULL CONSTRAINT [PrototypeFile_stateId_df] DEFAULT 1,
    [datasetId] UNIQUEIDENTIFIER NOT NULL,
    [caseId] NVARCHAR(200) NOT NULL,
    [category] VARCHAR(20) NOT NULL,
    [anchor] NVARCHAR(400) NOT NULL,
    [documentId] NVARCHAR(200),
    [documentVersion] INT,
    [originalName] NVARCHAR(255) NOT NULL,
    [mimeType] VARCHAR(120) NOT NULL,
    [size] INT NOT NULL,
    [sha256] CHAR(64) NOT NULL,
    [storageKey] VARCHAR(90) NOT NULL,
    [source] VARCHAR(20) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PrototypeFile_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [uploadedBy] NVARCHAR(MAX) NOT NULL,
    CONSTRAINT [PrototypeFile_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PrototypeFile_storageKey_key] UNIQUE NONCLUSTERED ([storageKey]),
    CONSTRAINT [PrototypeFile_datasetId_caseId_category_anchor_key] UNIQUE NONCLUSTERED ([datasetId], [caseId], [category], [anchor]),
    CONSTRAINT [PrototypeFile_stateId_fkey] FOREIGN KEY ([stateId]) REFERENCES [dbo].[PrototypeState]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [PrototypeFile_size_check] CHECK ([size] > 0 AND [size] <= 10000000),
    CONSTRAINT [PrototypeFile_source_check] CHECK ([source] IN ('uploaded', 'generated-demo'))
);
CREATE NONCLUSTERED INDEX [PrototypeFile_datasetId_caseId_idx] ON [dbo].[PrototypeFile]([datasetId], [caseId]);
COMMIT TRAN;
END TRY
BEGIN CATCH
IF @@TRANCOUNT > 0 ROLLBACK TRAN;
THROW;
END CATCH;
