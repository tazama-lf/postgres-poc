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

export const handleRule025 = async (
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

  if (
    !ruleConfig.config.parameters.tolerance ||
    typeof ruleConfig.config.parameters.tolerance !== 'number'
  ) {
    throw new Error(
      'Invalid config provided - tolerance parameter not provided or invalid type',
    );
  }

  if (
    !ruleConfig.config.parameters.maxQueryRange ||
    typeof ruleConfig.config.parameters.maxQueryRange !== 'number'
  ) {
    throw new Error(
      'Invalid config provided - maxQueryRange parameter not provided or invalid type',
    );
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

  if (!req.DataCache.dbtrAcctId) {
    throw new Error('DataCache object not retrievable');
  }

  if (!req.DataCache.instdAmt || !req.DataCache.instdAmt.amt) {
    throw new Error('DataCache amount not retrievable');
  }

  if (!req.DataCache.creDtTm) {
    throw new Error('DataCache CreDtTm not retrievable');
  }

  const debtorAccountId = `${req.DataCache.dbtrAcctId}`;
  const maxQueryRange: number = ruleConfig.config.parameters.maxQueryRange;

  const currentPacs002TimeFrame = req.transaction.FIToFIPmtSts.GrpHdr.CreDtTm;

  const creDtTm = `${req.DataCache.creDtTm}`;

  const response = await databaseManager._pseudonymsDb.query(
    `
WITH all_successful_pacs002 AS (
    SELECT endToEndId
    FROM transaction_relationship
    WHERE source = $1
      AND txTp = 'pacs.002.001.12'
      AND txSts = 'ACCC'
      and (extract(epoch from $2::timestamptz - credttm::timestamptz) * 1000) <= $3
      AND creDtTm::timestamptz <= $2::timestamptz
)
        SELECT array_agg(tr.amt ORDER BY tr.creDtTm::timestamptz DESC)
        FROM transaction_relationship tr
        WHERE tr.txTp = 'pacs.008.001.10'
          AND tr.endToEndId IN (SELECT endToEndId FROM all_successful_pacs002)
          AND tr.creDtTm::timestamptz <= $4::timestamptz`,
    [debtorAccountId, currentPacs002TimeFrame, maxQueryRange, creDtTm],
  );

  const res = response.rows[0].array_agg ?? [];

  /* eslint-disable-next-line @typescript-eslint/no-unsafe-argument */
  const unWrappedResult = unwrap<{ historicalAmounts: number[] }>([
    [
      {
        historicalAmounts: res.map((value: string) => Number(value)),
      },
    ],
  ]);

  if (!unWrappedResult?.historicalAmounts[0]) {
    const reason =
      ruleConfig.config.exitConditions.find(
        (exit) => exit.subRuleRef === '.x01',
      )?.reason ??
      'Insufficient transaction history and no exit condition in config';
    return { ...ruleResult, subRuleRef: '.x01', reason };
  }

  const allNumbers = unWrappedResult.historicalAmounts.every(
    (element) => typeof element === 'number',
  );

  if (!allNumbers) {
    throw new Error(
      'Data error: query result type mismatch - expected [numbers]',
    );
  }

  const tolerance: number = ruleConfig.config.parameters.tolerance;
  const targetAmount: number = req.DataCache.instdAmt.amt;
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
