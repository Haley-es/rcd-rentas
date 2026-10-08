BEGIN TRY
BEGIN TRAN;

ALTER TABLE [dbo].[PrototypeChangeHistory]
  ADD [recordDeleted] BIT NOT NULL CONSTRAINT [PrototypeChangeHistory_recordDeleted_df] DEFAULT 0;

-- Cover earlier changes as well as the deletion snapshot for records in trash.
EXEC(N'UPDATE h SET [recordDeleted] = 1
  FROM [dbo].[PrototypeChangeHistory] h
  WHERE EXISTS (SELECT 1 FROM [dbo].[PrototypeChangeHistory] d
    WHERE d.[datasetId] = h.[datasetId] AND d.[tableName] = h.[tableName]
      AND d.[recordId] = h.[recordId] AND d.[operation] = ''DELETE'' AND d.[restoredAt] IS NULL)');

EXEC(N'CREATE FUNCTION [dbo].[prototype_history_visible](@operation varchar(10), @recordDeleted bit)
RETURNS TABLE WITH SCHEMABINDING AS RETURN
  SELECT 1 AS allowed
  WHERE TRY_CONVERT(bigint, SESSION_CONTEXT(N''rcd_history_transaction'')) = CURRENT_TRANSACTION_ID()
    AND (CONVERT(nvarchar(50), SESSION_CONTEXT(N''rcd_history_role'')) = N''Administrador IT''
      OR (CONVERT(nvarchar(50), SESSION_CONTEXT(N''rcd_history_role'')) = N''Empleado''
        AND @operation <> ''DELETE'' AND @recordDeleted = 0))');

EXEC(N'CREATE SECURITY POLICY [dbo].[PrototypeChangeHistoryAccess]
  ADD FILTER PREDICATE [dbo].[prototype_history_visible]([operation], [recordDeleted])
  ON [dbo].[PrototypeChangeHistory]
  WITH (STATE = ON, SCHEMABINDING = ON)');

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH
