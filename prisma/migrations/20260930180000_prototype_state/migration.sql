BEGIN TRY

BEGIN TRAN;

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'dbo') EXEC sp_executesql N'CREATE SCHEMA [dbo];';

CREATE TABLE [dbo].[PrototypeInstallation] (
    [id] INT NOT NULL,
    [schemaVersion] INT NOT NULL,
    [initializedAt] DATETIME2 NOT NULL CONSTRAINT [PrototypeInstallation_initializedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PrototypeInstallation_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE TABLE [dbo].[PrototypeState] (
    [id] INT NOT NULL,
    [revision] INT NOT NULL,
    [datasetId] UNIQUEIDENTIFIER NOT NULL,
    [schemaVersion] INT NOT NULL,
    [payload] NVARCHAR(max) NOT NULL,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PrototypeState_pkey] PRIMARY KEY CLUSTERED ([id])
);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
