// SPDX-License-Identifier: Apache-2.0

import {
  type DatabaseManagerInstance,
  type LoggerService,
  type ManagerConfig,
} from '@tazama-lf/frms-coe-lib';
import {
  type RuleConfig,
  type RuleRequest,
  type RuleResult,
  type OutcomeResult,
} from '@tazama-lf/frms-coe-lib/lib/interfaces';

export const handleRule030 = async (
  req: RuleRequest,
  determineOutcome: (
    value: number,
    ruleConfig: RuleConfig,
    ruleResult: RuleResult,
  ) => RuleResult,
  ruleResult: RuleResult,
  loggerService: LoggerService,
  ruleConfig: RuleConfig,
  databaseManager: DatabaseManagerInstance<ManagerConfig>,
): Promise<RuleResult> => {
  if (!ruleConfig?.config?.bands) {
    throw new Error('Invalid config provided - bands not provided');
  }

  if (!ruleConfig.config.exitConditions) {
    throw new Error('Invalid config provided - exitConditions not provided');
  }

  if (req.transaction.FIToFIPmtSts.TxInfAndSts.TxSts !== 'ACCC') {
    const UnsuccessfulTransaction = ruleConfig.config.exitConditions.find(
      (b: OutcomeResult) => b.subRuleRef === '.x00',
    );
    if (UnsuccessfulTransaction === undefined) {
      throw new Error(
        'Unsuccessful transaction and no exit condition in config',
      );
    }
    return {
      ...ruleResult,
      reason: UnsuccessfulTransaction.reason,
      subRuleRef: UnsuccessfulTransaction.subRuleRef,
    };
  }

  if (!req.DataCache.cdtrAcctId || !req.DataCache.dbtrAcctId) {
    throw new Error('DataCache object not retrievable');
  }

  const currentPacs002TimeFrame = req.transaction.FIToFIPmtSts.GrpHdr.CreDtTm;

  const creditorAccountId = `${req.DataCache.cdtrAcctId}`;

  const debtorAccountId = `${req.DataCache.dbtrAcctId}`;

  const res = await databaseManager._pseudonymsDb.query(
    `
  select count (*) from transaction_relationship
    where source = $1 
      and destination = $2
      and txtp = $3
      and txsts = $4
      and credttm::timestamptz <= $5::timestamptz;`,
    [
      creditorAccountId,
      debtorAccountId,
      'pacs.002.001.12',
      'ACCC',
      currentPacs002TimeFrame,
    ],
  );

  const numberOfSuccessfulTransactions = Number(res.rows[0].count);

  // const numberOfSuccessfulTransactionsData: number[][] = await (await databaseManager._pseudonymsDb.query(queryString)).batches.all();

  // const numberOfSuccessfulTransactions: number = unwrap<number>(numberOfSuccessfulTransactionsData) ?? 0;

  if (!numberOfSuccessfulTransactions) {
    throw new Error(
      'Data error: irretrievable successful transaction from creditor and debtor accounts',
    );
  }

  if (typeof numberOfSuccessfulTransactions !== 'number') {
    throw new Error('Data error: query result type mismatch - expected number');
  }

  return determineOutcome(
    numberOfSuccessfulTransactions,
    ruleConfig,
    ruleResult,
  );
};
