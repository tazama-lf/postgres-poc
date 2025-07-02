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

export async function handleRule021(
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
  if (
    !ruleConfig.config.parameters // ||
    // typeof ruleConfig.config.parameters.tolerance !== 'number'
  ) {
    throw new Error(
      'Invalid config provided - tolerance parameter not provided or invalid type',
    );
  }

  const InsufficientHistory = ruleConfig.config.exitConditions.find(
    (b: { reason: string; subRuleRef: string }) => b.subRuleRef === '.x01',
  );

  const UnsuccessfulTransaction = ruleConfig.config.exitConditions.find(
    (b: { reason: string; subRuleRef: string }) => b.subRuleRef === '.x00',
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

  const currentPacs002TimeFrame = req.transaction.FIToFIPmtSts.GrpHdr.CreDtTm;
  const creditorAccount = `${req.DataCache.cdtrAcctId!}`;

  const maxQueryRange: number | undefined = ruleConfig.config.parameters
    ?.maxQueryRange as number;

  // const getAmtNewestPacs008 = aql`LET allSuccessfulPacs002 = (
  //     FOR pacs002 IN transactionRelationship
  //         FILTER pacs002._from == ${creditorAccountAql}
  //         AND pacs002.TxTp == "pacs.002.001.12"
  //         AND pacs002.TxSts == "ACCC"
  //         ${maxQueryRangeAql}
  //         AND pacs002.CreDtTm <= ${currentPacs002TimeFrame}
  //     RETURN pacs002.EndToEndId
  // )

  // FOR newestPacs008 IN transactionRelationship
  //     FILTER newestPacs008.TxTp == "pacs.008.001.10"
  //     AND newestPacs008.EndToEndId IN allSuccessfulPacs002
  //     SORT newestPacs008.CreDtTm DESC
  // RETURN newestPacs008.Amt`;

  const results = await databaseManager._pseudonymsDb.query(
    `
    WITH allSuccessfulPacs002 AS (
      SELECT endtoendid
      FROM transaction_relationship
      WHERE source = $1
        AND txtp = $2
        AND txsts = $3
        and (extract(epoch from $4::timestamptz - credttm::timestamptz) * 1000) <= $5
        AND credttm::timestamptz <= $4::timestamptz
    )
    SELECT amt
    FROM transaction_relationship
    WHERE txtp = $6
      AND endtoendid IN (SELECT endtoendid FROM allSuccessfulPacs002)
    ORDER BY credttm::timestamptz DESC;
`,
    [
      creditorAccount,
      'pacs.002.001.12',
      'ACCC',
      currentPacs002TimeFrame,
      maxQueryRange,
      'pacs.008.001.10',
    ],
  );

  const pacs008Amt: number[] =
    results.rows?.map((value: { amt: number | string }) => Number(value.amt)) ??
    [];

  if (!pacs008Amt || !pacs008Amt[0] || pacs008Amt.length <= 0) {
    throw new Error('Data error: irretrievable transaction history');
  }

  /* eslint-disable-next-line @typescript-eslint/no-unsafe-argument */
  if (!isNumbersArray(pacs008Amt)) {
    throw new Error(
      'Data error: query result type mismatch - expected [numbers]',
    );
  }

  if (pacs008Amt.length <= 1) {
    if (InsufficientHistory === undefined) {
      throw new Error('Insufficient History and no exit condition in config');
    }

    return {
      ...ruleRes,
      subRuleRef: InsufficientHistory.subRuleRef,

      reason: InsufficientHistory.reason,
    };
  }
  const toleranceValue = ruleConfig.config.parameters.tolerance as number;
  // Calculate if matching numbers is within tolerance of first (latest) value
  const amounts = pacs008Amt;
  const tolerance = amounts[0] * toleranceValue;
  const countOfMatchingAmounts = amounts.reduce((n, val) => {
    if (Math.abs(val - amounts[0]) <= tolerance) {
      return ++n;
    }
    return n;
  }, 0);

  ruleRes = determineOutcome(countOfMatchingAmounts, ruleConfig, ruleRes);
  return ruleRes;
}

function isNumbersArray(arr: unknown[]): boolean {
  for (const el of arr) {
    if (typeof el !== 'number') return false;
  }
  return true;
}
