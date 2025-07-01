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

export const handleRule008 = async (
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

  if (!ruleConfig.config.exitConditions) {
    throw new Error('Invalid config provided - exitConditions not provided');
  }

  if (!req.DataCache.dbtrAcctId) {
    throw new Error('DataCache object not retrievable');
  }

  const maxQueryLimit: number | undefined = ruleConfig.config.parameters
    ?.maxQueryLimit as number;

  if (req.transaction.FIToFIPmtSts.TxInfAndSts.TxSts !== 'ACCC') {
    const UnsuccessfulTransaction = ruleConfig.config.exitConditions.find(
      (b: { reason: string; subRuleRef: string }) => b.subRuleRef === '.x00',
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
  const debtorAccountId = req.DataCache.dbtrAcctId;
  const currentPacs002TimeFrame = req.transaction.FIToFIPmtSts.GrpHdr.CreDtTm;

  const result = await databaseManager._pseudonymsDb.query(
    'SELECT source FROM transaction_relationship WHERE destination = $1 AND txtp = $2 AND txsts = $3 AND credttm <= $4 ORDER BY credttm::timestamptz DESC LIMIT $5;',
    [
      debtorAccountId,
      'pacs.002.001.12',
      'ACCC',
      currentPacs002TimeFrame,
      maxQueryLimit,
    ],
  );

  if (!result.rows.length) {
    throw new Error('Data error: irretrievable transaction history');
  }

  const newestPacs008 = result.rows.map(
    (value: { source: string }) => value.source,
  );

  if (
    !newestPacs008 ||
    newestPacs008.length > (maxQueryLimit || 3) ||
    newestPacs008.length < 2
  ) {
    const InsufficientHistory = ruleConfig.config.exitConditions.find(
      (b: { reason: string; subRuleRef: string }) => b.subRuleRef === '.x01',
    );

    if (InsufficientHistory === undefined) {
      throw new Error('Insufficient History and no exit condition in config');
    }
    return {
      ...ruleResult,
      reason: InsufficientHistory.reason,
      subRuleRef: InsufficientHistory.subRuleRef,
    };
  }

  const mostRecentCreditorId = newestPacs008[0][0];

  const countOfMatchingCreditors: number = newestPacs008[0].reduce(
    (accumulator: number, current: string) =>
      current === mostRecentCreditorId ? accumulator + 1 : accumulator,
    0,
  );

  return determineOutcome(countOfMatchingCreditors, ruleConfig, ruleResult);
};
