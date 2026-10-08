BEGIN TRY
BEGIN TRAN;

CREATE TABLE [dbo].[PrototypeChangeHistory] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [datasetId] UNIQUEIDENTIFIER NOT NULL,
    [revision] INT NOT NULL,
    [tableName] VARCHAR(30) NOT NULL,
    [recordId] NVARCHAR(200) NOT NULL,
    [recordLabel] NVARCHAR(200) NOT NULL,
    [operation] VARCHAR(10) NOT NULL,
    [changedBy] NVARCHAR(max) NOT NULL,
    [changedRole] NVARCHAR(50) NOT NULL,
    [changedAt] DATETIME2 NOT NULL CONSTRAINT [PrototypeChangeHistory_changedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [changes] NVARCHAR(max) NOT NULL,
    [snapshot] NVARCHAR(max),
    [restoredAt] DATETIME2,
    CONSTRAINT [PrototypeChangeHistory_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PrototypeChangeHistory_operation_ck] CHECK ([operation] IN ('INSERT', 'UPDATE', 'DELETE', 'RESTORE')),
    CONSTRAINT [PrototypeChangeHistory_json_ck] CHECK (ISJSON([changes]) = 1 AND ([snapshot] IS NULL OR ISJSON([snapshot]) = 1))
);
CREATE NONCLUSTERED INDEX [PrototypeChangeHistory_datasetId_tableName_recordId_revision_idx]
    ON [dbo].[PrototypeChangeHistory]([datasetId], [tableName], [recordId], [revision]);
CREATE NONCLUSTERED INDEX [PrototypeChangeHistory_datasetId_operation_restoredAt_idx]
    ON [dbo].[PrototypeChangeHistory]([datasetId], [operation], [restoredAt]);

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH
