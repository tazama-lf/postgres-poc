// SPDX-License-Identifier: Apache-2.0

import { type DBConfig, type DatabaseManagerType } from '../services/dbManager';
import type { DataCache, NetworkMap } from '../interfaces';
import { Pool } from 'pg';
import { v4 } from 'uuid';

export async function transactionBuilder(manager: DatabaseManagerType, transactionConfig: DBConfig, redis: boolean): Promise<void> {
  manager._transaction = new Pool({
    host: transactionConfig.url,
    database: transactionConfig.databaseName,
    user: transactionConfig.user,
    password: transactionConfig.password,
  });

  manager.getReportByMessageId = async (messageid: string) => {
    const db = manager._transaction;

    const res = await db?.query(`select transaction from transaction where messageId = $1`, [messageid]);
    return res?.rows.map((value) => value.transaction);
  };

  manager.insertTransaction = async (
    transactionID: string,
    transaction: unknown,
    networkMap: NetworkMap,
    alert: unknown,
    dataCache?: DataCache,
  ) => {
    const data = {
      transactionID,
      transaction,
      networkMap,
      report: alert,
      dataCache,
    };
    const db = manager._transaction;
    await db?.query(
      `
        insert into transaction
          (uuid, transaction)
        values
          ($1, $2)
        `,
      [v4(), data],
    );
  };
}
