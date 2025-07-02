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

export async function handleRule048(
  req: RuleRequest,
  determineOutcome: (
    value: number,
    ruleConfig: RuleConfig,
    ruleResult: RuleResult,
  ) => RuleResult,
  ruleRes: RuleResult,
  loggerService: LoggerService,
  ruleConfig: RuleConfig,
  databaseManager: DatabaseManagerInstance<ManagerConfig>,
): Promise<RuleResult> {
  // Guard statements to throw errors early
  if (!ruleConfig.config.bands) {
    throw new Error('Invalid config provided - bands not provided');
  }
  if (!ruleConfig.config.exitConditions) {
    throw new Error('Invalid config provided - exitConditions not provided');
  }

  const InsufficientHistory = ruleConfig.config.exitConditions.find(
    (b: { reason: string; subRuleRef: string }) => b.subRuleRef === '.x01',
  );

  const UnsuccessfulTransaction = ruleConfig.config.exitConditions.find(
    (b: { reason: string; subRuleRef: string }) => b.subRuleRef === '.x00',
  );

  const NoVarianceIncrease = ruleConfig.config.exitConditions.find(
    (b: { reason: string; subRuleRef: string }) => b.subRuleRef === '.x03',
  );

  const NoVarianceEqualOrDecrease = ruleConfig.config.exitConditions.find(
    (b: { reason: string; subRuleRef: string }) => b.subRuleRef === '.x04',
  );

  if (req.transaction.FIToFIPmtSts.TxInfAndSts.TxSts !== 'ACCC') {
    if (UnsuccessfulTransaction === undefined) {
      throw new Error(
        'Unsuccessful transaction and no exit condition in config',
      );
    }

    return {
      ...ruleRes,
      reason: UnsuccessfulTransaction.reason,
      subRuleRef: UnsuccessfulTransaction.subRuleRef,
    };
  }

  const endToEndId = req.transaction.FIToFIPmtSts.TxInfAndSts.OrgnlEndToEndId;
  const currentPacs002TimeFrame = req.transaction.FIToFIPmtSts.GrpHdr.CreDtTm;
  const debtorAccount = `${req.DataCache.dbtrAcctId!}`;

  const res = await databaseManager._pseudonymsDb.query(
    `
    WITH allSuccessfulPacs002 AS (
      SELECT endtoendid
      FROM transaction_relationship
      WHERE source = $1
      AND txtp = 'pacs.002.001.12'
      AND txsts = 'ACCC'
      AND credttm::timestamptz <= $2::timestamptz
    )
    SELECT 
      pacs008.endtoendid,
      pacs008.credttm,
      pacs008.amt AS Amount
    FROM transaction_relationship pacs008
    WHERE pacs008.txtp = 'pacs.008.001.10'
    AND pacs008.endtoendid IN (SELECT endtoendid FROM allSuccessfulPacs002)
    `,
    [debtorAccount, currentPacs002TimeFrame],
  );

  const successSets = res.rows as Array<{
    endtoendid: string;
    credttm: string;
    amt: number;
  }>;

  const e2eIndex =
    successSets &&
    successSets[0] &&
    successSets.findIndex((i) => i.endtoendid === endToEndId);

  if (
    typeof e2eIndex !== 'number' ||
    !successSets ||
    !successSets ||
    successSets.length <= 1 ||
    e2eIndex < 0
  ) {
    if (InsufficientHistory === undefined) {
      throw new Error('Insufficient History and no exit condition in config');
    }

    return {
      ...ruleRes,
      subRuleRef: InsufficientHistory.subRuleRef,

      reason: InsufficientHistory.reason,
    };
  }
  /* eslint-disable-next-line @typescript-eslint/no-unsafe-argument */
  // if (!isSuccessSet(successSets[0])) {
  //   throw new Error(
  //     'Data error: query result type mismatch - expected [{timestamps, amounts}]',
  //   );
  // }

  const transactions = [
    {
      CreDtTm: successSets[0].credttm,
      Amount: successSets[0].amt,
      EndToEndId: successSets[0].endtoendid,
    },
  ];

  const currentTransaction = transactions.splice(e2eIndex, 1)[0];
  const { avg, stdDev } = calcAvgAndStandardDev(transactions);

  /*
    If the standard deviation == 0 and the amount of the current transaction > the historical average amount, abort with exit condition .x03
  */

  if (stdDev === 0 && currentTransaction.Amount > avg) {
    if (NoVarianceIncrease === undefined) {
      throw new Error(
        'No Variance with Increase and no exit condition in config',
      );
    }

    return {
      ...ruleRes,
      subRuleRef: NoVarianceIncrease.subRuleRef,
      reason: NoVarianceIncrease.reason,
    };
  }

  /*
    If the standard deviation == 0 and the amount of the current transaction <= the historical average amount, abort with exit condition .x04
  */

  if (stdDev === 0 && currentTransaction.Amount <= avg) {
    if (NoVarianceEqualOrDecrease === undefined) {
      throw new Error(
        'No Variance with Equal or Decrease and no exit condition in config',
      );
    }

    return {
      ...ruleRes,
      subRuleRef: NoVarianceEqualOrDecrease.subRuleRef,
      reason: NoVarianceEqualOrDecrease.reason,
    };
  }

  /*
    The requirements for this rule is to evaluate the amount of the latest transaction
    against the historical average plus a specific number of standard deviations.
    The rule config contains the standard deviation multipliers as the band limits for the evaluation
    and a straightforward evaluation of the amount against a band is not yet possible.
    This transformation is currently handled in the rule processor where the latest amount is
    evaluated against the average plus the limits multiplied by the standard deviation.

    Iterate through all the result bands in the config.bands[] array and replace the current band limits with:
    band limit * standard deviation + mean.
  */

  for (let i = 0; i < ruleConfig.config.bands.length; i++) {
    if (
      'upperLimit' in ruleConfig.config.bands[i] &&
      typeof ruleConfig.config.bands[i].upperLimit === 'number'
    ) {
      ruleConfig.config.bands[i].upperLimit =
        ruleConfig.config.bands[i].upperLimit! * stdDev + avg;
    }
    if (
      'lowerLimit' in ruleConfig.config.bands[i] &&
      typeof ruleConfig.config.bands[i].lowerLimit === 'number'
    ) {
      ruleConfig.config.bands[i].lowerLimit =
        ruleConfig.config.bands[i].lowerLimit! * stdDev + avg;
    }
  }

  ruleRes = determineOutcome(currentTransaction.Amount, ruleConfig, ruleRes);

  return ruleRes;
}

// function isSuccessSet(arr: unknown[]): boolean {
//   for (const el of arr) {
//     if (
//       el === null ||
//       typeof el !== 'object' ||
//       !('CreDtTm' in el) ||
//       !('Amount' in el) ||
//       !('EndToEndId' in el) ||
//       typeof el.CreDtTm !== 'string' ||
//       typeof el.Amount !== 'number' ||
//       typeof el.EndToEndId !== 'string'
//     ) {
//       return false;
//     }
//   }
//   return true;
// }

function calcAvgAndStandardDev(
  arr: Array<{ CreDtTm: string; Amount: number }>,
): { avg: number; stdDev: number } {
  const n = arr.length;
  let sum = 0;
  let sumSquared = 0;

  arr.forEach((el) => {
    sum += el.Amount;
  });

  const avg = sum / n;

  arr.forEach((el) => {
    sumSquared += (el.Amount - avg) * (el.Amount - avg);
  });

  const variance = sumSquared / (n - 1);
  const stdDev = Math.sqrt(variance);

  return { avg, stdDev };
}
