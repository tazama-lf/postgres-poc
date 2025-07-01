// SPDX-License-Identifier: Apache-2.0

import { type TransactionRelationship } from '../interfaces';
import { type DatabaseManagerType, type DBConfig } from '../services/dbManager';
import { Pool } from 'pg';

export async function pseudonymsBuilder(manager: DatabaseManagerType, pseudonymsConfig: DBConfig): Promise<void> {
  manager._pseudonymsDb = new Pool({
    host: pseudonymsConfig.url,
    database: pseudonymsConfig.databaseName,
    user: pseudonymsConfig.user,
    password: pseudonymsConfig.password,
  });

  manager.getPseudonyms = async (hash: string) => {
    const db = manager._pseudonymsDb;

    const results = await db?.query('select document from pseudonym where pseudonym = $1', [hash]);

    return results?.rows.map((value) => value.document);
  };

  manager.saveTransactionRelationship = async (tr: TransactionRelationship) => {
    const db = manager._pseudonymsDb;

    await db?.query(
      `
        insert into transaction_relationship
          (
            source,
            destination,
            transaction_relationship
        ) values
        (
          $1, $2, $3
        )`,
      [tr.from, tr.to, tr],
    );
  };

  manager.getPacs008Edge = async (endToEndIds: string[]) => {
    const db = manager._pseudonymsDb;

    if (!Array.isArray(endToEndIds) || endToEndIds.length === 0) {
      return [];
    }

    const placeholders = endToEndIds.map((_, idx) => `$${idx + 1}`).join(', ');
    const values = [...endToEndIds, 'pacs.008.001.10'];

    const query = `
      select transaction_relationship from
        transaction_relationship
      where
        end_to_end_id IN (${placeholders})
      and
        tx_tp = $${values.length}
    `;

    const res = await db?.query(query, values);
    return res?.rows.map((value) => value.transaction_relationship);
  };

  manager.getPacs008Edges = async (accountId: string, threshold?: string, amount?: number) => {
    const db = manager._pseudonymsDb;

    const values = [];
    let query = `
      select transaction_relationship from
        transaction_relationship
      where
        txTp = 'pacs.008.001.10'
      and
        destination = $1
    `;
    values.push(accountId);

    if (threshold) {
      values.push(threshold);
      query = `${query} and creDtTm < $${values.length}`;
    }

    if (amount !== undefined) {
      values.push(amount);
      query = `${query} and amt = $${values.length}`;
    }

    const res = await db?.query(query, values);
    return res?.rows.map((value) => value.transaction_relationship);
  };

  manager.getPacs002Edge = async (endToEndIds: string[]) => {
    const db = manager._pseudonymsDb;

    if (!Array.isArray(endToEndIds) || endToEndIds.length === 0) {
      return [];
    }

    // Check if building placeholders dynamically works or maybe better impl
    // : $1, $2, ..., $n
    const placeholders = endToEndIds.map((_, idx) => `$${idx + 1}`).join(', ');
    const txTpValue = 'pacs.002.001.12';
    const values = [...endToEndIds, txTpValue];

    const query = `
    select transaction_relationship from
      transaction_relationship
    where
      endToEndId IN (${placeholders})
    and
      txTp = $${values.length}
  `;

    const res = await db?.query(query, values);
    return res?.rows.map((value) => value.transaction_relationship);
  };

  manager.getDebtorPacs002Edges = async (debtorId: string): Promise<unknown> => {
    const db = manager._pseudonymsDb;
    const debtorAccount = `accounts/${debtorId}`;
    const query = `
      select
        transaction_relationship
      from
        transaction_relationship
      where
        source = $1
      and
        txTp = 'pacs.002.001.12'
      and
        txSts = 'ACCC'
    `;
    const values = [debtorAccount];

    const res = await db?.query(query, values);
    return res?.rows.map((value) => value.transaction_relationship);
  };

  manager.getIncomingPacs002Edges = async (accountId: string, limit?: number): Promise<unknown> => {
    const db = manager._pseudonymsDb;
    const values: Array<string | number> = [accountId, 'pacs.002.001.12', 'ACCC'];
    let query = `
      select
        transaction_relationship
      from
        transaction_relationship
      where
        destination = $1
      and
        txTp = $2
      and
        txSts = $3
    `;

    if (limit !== undefined) {
      values.push(limit);
      query += ` LIMIT $${values.length}`;
    }

    const res = await db?.query(query, values);
    return res?.rows.map((value) => value.transaction_relationship);
  };

  manager.getOutgoingPacs002Edges = async (accountId: string, limit?: number): Promise<unknown> => {
    const db = manager._pseudonymsDb;

    const values: Array<string | number> = [accountId, 'pacs.002.001.12', 'ACCC'];
    let query = `
      select
        transaction_relationship
      from
        transaction_relationship
      where
        source = $1
      and
        txTp = $2
      and
        txSts = $3
    `;

    if (limit !== undefined) {
      values.push(limit);
      query = `${query} limit $${values.length}`;
    }

    const res = await db?.query(query, values);
    return res?.rows.map((value) => value.transaction_relationship);
  };

  manager.getSuccessfulPacs002Edges = async (creditorId: string[], debtorId: string, endToEndId: string[]): Promise<unknown> => {
    const db = manager._pseudonymsDb;

    let paramIndex = 2;

    const creditorPlaceholders = creditorId.map(() => `$${paramIndex++}`);
    const endToEndPlaceholders = endToEndId.map(() => `$${paramIndex++}`);

    const query = `
      select
        transaction_relationship
      from
        transaction_relationship
      where
        source = $1
      and
        destination IN (${creditorPlaceholders.join(', ')})
      and
        txTp = 'pacs.002.001.12'
      and
        endToEndId IN (${endToEndPlaceholders.join(', ')})
      and
        txSts = 'ACCC'
      order by creDtTm desc
      limit 2
    `;

    const res = await db?.query(query, [debtorId, ...creditorId, ...endToEndId]);

    return res?.rows.map((value) => value.transaction_relationship);
  };

  manager.getCreditorPacs008Edges = async (creditorId: string) => {
    const db = manager._pseudonymsDb;

    const query = `
      select
        transaction_relationship
      from
        transaction_relationship
      where
        destination = $1
      and
        txTp = 'pacs.008.001.10'
      order by creDtTm DESC
      LIMIT 2
    `;

    const res = await db?.query(query, [creditorId]);
    return res?.rows.map((value) => value.transaction_relationship);
  };

  manager.getPreviousPacs008Edges = async (accountId: string, limit?: number, to?: string[]) => {
    const db = manager._pseudonymsDb;

    const values: Array<string | number> = [accountId, 'pacs.008.001.10'];
    let paramIndex = values.length + 1;

    let toFilter = '';
    if (to !== undefined && Array.isArray(to) && to.length > 0) {
      const placeholders = to.map(() => `$${paramIndex++}`).join(', ');
      values.push(...to);
      toFilter = `AND destination IN (${placeholders})`;
    }

    const safeLimit = typeof limit === 'number' && limit > 0 ? limit : 3;

    const query = `
      select
        transaction_relationship
      from
        transaction_relationship
      where
        source = $1
      and
        tx_tp = $2
      ${toFilter}
      order by creDtTm desc
      limit $${paramIndex}
    `;

    values.push(safeLimit);

    const res = await db?.query(query, values);
    return res?.rows.map((value) => value.transaction_relationship);
  };

  manager.getCreditorPacs002Edges = async (creditorId: string, threshold: number) => {
    const db = manager._pseudonymsDb;

    const date = new Date(Date.now() - threshold).toISOString();

    const query = `
      select
        transaction_relationship
      from
        transaction_relationship
      where
        source = $1
      and
        txTp = 'pacs.002.001.12'
      and
        txSts = 'ACCC'
      and
        creDtTm >= $2
    `;

    const values = [creditorId, date];
    const res = await db?.query(query, values);
    return res?.rows.map((value) => value.transaction_relationship);
  };

  manager.saveAccount = async (key: string) => {
    const db = manager._pseudonymsDb;
    await db?.query(`
        insert into account
          (id)
        values
          ($1)
        on conflict (id) do nothing`,
      [key],
    );
  };

  manager.saveEntity = async (entityId: string, CreDtTm: string) => {
    const db = manager._pseudonymsDb;
    await db?.query(`
        insert into entity
          (id, creDtTm)
        values
          ($1, $2)
        on conflict (id) do nothing`,
      [entityId, CreDtTm],
    );
  };

  manager.saveAccountHolder = async (entityId: string, accountId: string, CreDtTm: string) => {
    const db = manager._pseudonymsDb;
    await db?.query(`
        insert into account_holder
          (source, destination, creDtTm)
        values
          ($1, $2, $3)
        on conflict (source, destination) do nothing`,
      [entityId, accountId, CreDtTm],
    );
  };
}
