// SPDX-License-Identifier: Apache-2.0

import { AccountType, type Pacs002, type Pacs008 } from '../interfaces';
import { type DatabaseManagerType, type DBConfig } from '../services/dbManager';
import { Pool } from 'pg';
import { v4 } from 'uuid';

export async function transactionHistoryBuilder(
  manager: DatabaseManagerType,
  transactionHistoryConfig: DBConfig,
  redis: boolean,
): Promise<void> {
  manager._transactionHistory = new Pool({
    host: transactionHistoryConfig.url,
    database: transactionHistoryConfig.databaseName,
    user: transactionHistoryConfig.user,
    password: transactionHistoryConfig.password,
  });

  manager.getTransactionPacs008 = async (endToEndId: string) => {
    const db = manager._transactionHistory;
    const result = await db?.query('select document from pacs008 where endToEndId = $1', [endToEndId]);
    return result?.rows[0].document;
  };

  manager.getSuccessfulPacs002Msgs = async (endToEndId: string) => {
    const db = manager._transactionHistory;

    const result = await db?.query(
      `select
        document
      from
        pacs002
      where
        endToEndId = $1
      and
        document->'FIToFIPmtSts'->'TxInfAndSts'->>'TxSts' = ?
      order by
        document->'FIToFIPmtSts'->'GrpHdr'->>'CreDtTm'
      limit 1
    `,
      [endToEndId, 'ACCC'],
    );

    return result?.rows[0].document;
  };

  manager.getSuccessfulPacs002EndToEndIds = async (endToEndIds: string[]) => {
    const db = manager._transactionHistory;

    const result = await db?.query(
      `select
        endToEndId
      from
        pacs002
      where
        endToEndId = ANY($1)
      and
        document->'FIToFIPmtSts'->'TxInfAndSts'->>'TxSts' =  $2;
    `,
      [endToEndIds, 'ACCC'],
    );

    return result?.rows.map((row) => row.endToEndId);
  };

  manager.getAccountEndToEndIds = async (accountId: string, accountType: AccountType) => {
    const db = manager._transactionHistory;

    const isCreditor = accountType === AccountType.CreditorAcct;
    const accountPath = isCreditor ? 'CdtrAcct' : 'DbtrAcct';

    const query = `
      select
        endToEndId as e2eId,
        creDtTm as timestamp
      from
        pacs008,
        jsonb_array_elements(
          data->'FIToFICstmrCdtTrf'->'CdtTrfTxInf'->'${accountPath}'->'Id'->'Othr'
        ) as othr
      where
        othr->>'Id' = $1;
    `;

    const result = await db?.query(query, [accountId]);
    return result?.rows;
  };

  manager.getAccountHistoryPacs008Msgs = async (accountId: string, accountType: AccountType) => {
    const db = manager._transactionHistory;

    const isCreditor = accountType === AccountType.CreditorAcct;
    const accountPath = isCreditor ? 'CdtrAcct' : 'DbtrAcct';

    const query = `
      select
        document
      from
        pacs008,
        jsonb_array_elements(
          document->'FIToFICstmrCdtTrf'->'CdtTrfTxInf'->'${accountPath}'->'Id'->'Othr'
        ) AS othr
      where
        othr->>'id' = $1;
    `;

    const result = await db?.query(query, [accountId]);
    return result?.rows.map((row) => row.document);
  };

  manager.saveTransactionHistoryPacs008 = async (tran: Pacs008) => {
    const db = manager._transactionHistory;

    await db?.query(
      `
        insert into pacs008
          (id, document)
        values
          ($1, $2)`,
      [v4(), tran],
    );
  };

  manager.saveTransactionHistoryPacs002 = async (tran: Pacs002) => {
    const db = manager._transactionHistory;
    await db?.query(
      `
        insert into pacs002
          (id, document)
        values
          ($1, $2)`,
      [v4(), tran],
    );
  };
}
