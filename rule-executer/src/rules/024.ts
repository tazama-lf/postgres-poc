// SPDX-License-Identifier: Apache-2.0

import {
  type DatabaseManagerInstance,
  type LoggerService,
  type ManagerConfig,
} from '@tazama-lf/frms-coe-lib';
import {
  type OutcomeResult,
  type RuleConfig,
  type RuleRequest,
  type RuleResult,
} from '@tazama-lf/frms-coe-lib/lib/interfaces';
import { unwrap } from '@tazama-lf/frms-coe-lib/lib/helpers/unwrap';

export const amountTracking = (
  tolerance: number,
  targetAmount: number,
  historicalAmounts: number[],
): number => {
  let amountTracker = 0;
  const offsetTolerance = targetAmount * tolerance;

  for (let i = 0; i < historicalAmounts.length; i++) {
    const amount = historicalAmounts[i];
    amountTracker += amount;

    if (
      amountTracker > targetAmount - offsetTolerance &&
      amountTracker < targetAmount + offsetTolerance
    ) {
      return i + 1;
    }
  }

  return -1;
};

export const handleRule024 = async (
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

  if (!ruleConfig.config.parameters) {
    throw new Error('Invalid config provided - parameters not provided');
  }

  // if (!ruleConfig.config.parameters.tolerance || typeof ruleConfig.config.parameters.tolerance !== 'number') {
  //   throw new Error('Invalid config provided - tolerance parameter not provided or invalid type');
  // }

  // if (!ruleConfig.config.parameters.maxQueryRange || typeof ruleConfig.config.parameters.maxQueryRange !== 'number') {
  //   throw new Error('Invalid config provided - maxQueryRange parameter not provided or invalid type');
  // }

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

  if (!req.DataCache.cdtrAcctId) {
    throw new Error('DataCache object not retrievable');
  }

  if (!req.DataCache.creDtTm) {
    throw new Error('DataCache does not have CreDtTm');
  }

  const currentPacs002TimeFrame = req.transaction.FIToFIPmtSts.GrpHdr.CreDtTm;
  const creditorAccountId = `${req.DataCache.cdtrAcctId}`;
  const maxQueryRange: number = ruleConfig.config.parameters
    .maxQueryRange as number;
  const credttm = req.DataCache.creDtTm;

  const results = await databaseManager._pseudonymsDb.query(
    `
 WITH newestPacs008 AS (
    SELECT credttm::timestamptz
    FROM transaction_relationship
    WHERE source = $1
    AND txtp = 'pacs.008.001.10'
    AND credttm::timestamptz < $2::timestamptz
    ORDER BY credttm::timestamptz DESC
    limit 1
),
allSuccessfulPacs002 AS (
    SELECT endtoendid
    FROM transaction_relationship
    WHERE source = $1
    AND txtp = 'pacs.002.001.12'
    AND txsts = 'ACCC'
    and (extract(epoch from (select credttm from newestPacs008) - credttm::timestamptz) * 1000) <= $3
    and (extract(epoch from (select credttm from newestPacs008) - credttm::timestamptz) * 1000) > 0
    AND credttm::timestamptz <= $4::timestamptz
),
historicalAmounts AS (
    SELECT amt
    FROM transaction_relationship
    WHERE txtp = 'pacs.008.001.10'
    AND endtoendid IN (SELECT endtoendid FROM allSuccessfulPacs002)
    ORDER BY credttm::timestamptz DESC
)
SELECT 
    (SELECT amt FROM newestPacs008) AS targetAmount,
    historicalAmounts.amt AS historicalAmounts
FROM historicalAmounts;
`,
    [creditorAccountId, credttm, maxQueryRange, currentPacs002TimeFrame],
  );

  const recentSuccessfulTransactionsAndTargetAmount = results.rows as Array<{
    targetAmount: number;
    historicalAmounts: number[];
  }>;

  const unWrappedResult = unwrap<{
    targetAmount: number;
    historicalAmounts: number[];
  }>([recentSuccessfulTransactionsAndTargetAmount]);

  if (!unWrappedResult?.historicalAmounts[0]) {
    const reason =
      ruleConfig.config.exitConditions.find(
        (exit) => exit.subRuleRef === '.x01',
      )?.reason ??
      'Insufficient transaction history and no exit condition in config';
    return { ...ruleResult, subRuleRef: '.x01', reason };
  }

  if (!unWrappedResult.targetAmount) {
    throw new Error('Data error: irretrievable transaction history');
  }

  const allNumbers = unWrappedResult.historicalAmounts.every(
    (element) => typeof element === 'number',
  );

  if (!allNumbers) {
    throw new Error(
      'Data error: query result type mismatch - expected [numbers]',
    );
  }

  const tolerance: number = ruleConfig.config.parameters.tolerance as number;
  const targetAmount: number = unWrappedResult.targetAmount;
  const historicalAmounts: number[] = unWrappedResult.historicalAmounts;

  const iterationValue = amountTracking(
    tolerance,
    targetAmount,
    historicalAmounts,
  );

  if (iterationValue === -1) {
    const reason =
      ruleConfig.config.exitConditions.find(
        (exit) => exit.subRuleRef === '.x03',
      )?.reason ??
      'No non-commissioned transaction mirroring detected and no exit condition in config';
    return { ...ruleResult, subRuleRef: '.x03', reason };
  }

  return determineOutcome(iterationValue, ruleConfig, ruleResult);
};
