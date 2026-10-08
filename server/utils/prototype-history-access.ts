import type { Prisma } from '@prisma/client'
import type { AccessRole } from '../../shared/types/access-role'

// Always use the transaction connection, never the pool. The SQL predicate also
// checks the transaction ID so a rollback/failed cleanup cannot leak privileges.
export async function withPrototypeHistoryAccess<T>(tx: Prisma.TransactionClient, role: AccessRole,
  operation: () => Promise<T>): Promise<T> {
  await tx.$executeRaw`
    DECLARE @transactionId bigint = CURRENT_TRANSACTION_ID();
    EXEC sys.sp_set_session_context @key = N'rcd_history_role', @value = ${role};
    EXEC sys.sp_set_session_context @key = N'rcd_history_transaction', @value = @transactionId;
  `
  try { return await operation() }
  finally {
    await tx.$executeRaw`
      EXEC sys.sp_set_session_context @key = N'rcd_history_role', @value = NULL;
      EXEC sys.sp_set_session_context @key = N'rcd_history_transaction', @value = NULL;
    `
  }
}
