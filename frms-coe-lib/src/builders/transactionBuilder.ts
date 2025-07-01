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
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    maxLifetimeSeconds: 60,
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
          (source, destination, creDtTm)
        values
          ($1, $2, $3)
        on conflict (source, destination) do nothing`,
      [v4(), data],
    );
  };
}
