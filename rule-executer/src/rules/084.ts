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
} from '@tazama-lf/frms-coe-lib/lib/interfaces';
import { unwrap } from '@tazama-lf/frms-coe-lib/lib/helpers/unwrap';

export const handleRule084 = async (
  req: RuleRequest,
  determineOutcome: (
    value: number,
    ruleConfig: RuleConfig,
    ruleResult: RuleResult,
  ) => RuleResult,
  ruleResult: RuleResult,
  _loggerService: LoggerService,
  ruleConfig: RuleConfig,
  databaseManager: DatabaseManagerInstance<ManagerConfig>,
): Promise<RuleResult> => {
  if (!ruleConfig?.config?.bands) {
    throw new Error('Invalid config provided - bands not provided');
  }

  if (!req.DataCache.dbtrId) {
    throw new Error('DataCache object not retrievable');
  }

  const debtorId = `${req.DataCache.cdtrId}`;
  const currentPacs002TimeFrame = req.transaction.FIToFIPmtSts.GrpHdr.CreDtTm;

  const results = await databaseManager._pseudonymsDb.query(
    `
    select count (*) from account_holder where source = $1 and credttm::timestamptz <= $2::timestamptz`,
    [debtorId, currentPacs002TimeFrame],
  );

  const numberOfAccounts = Number(results.rows[0].count);

  if (!numberOfAccounts) {
    throw new Error('Data error: irretrievable debtor account information');
  }

  if (typeof numberOfAccounts !== 'number') {
    throw new Error(
      'Data error: query result type mismatch - expected [numbers]',
    );
  }

  return determineOutcome(numberOfAccounts, ruleConfig, ruleResult);
};
