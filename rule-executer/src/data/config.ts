import type { RuleConfig } from '@tazama-lf/frms-coe-lib/lib/interfaces';

export const IGNITE_RULE_CONFIG_CACHE_NAME = 'RuleConfiguration';
export const IGNITE_RULE_BANDS_CACHE_NAME = 'RuleBands';
export const IGNITE_RULE_EXITCONDITIONS_CACHE_NAME = 'RuleExitConditions';
export const IGNITE_RULE_PARAMETERS_CACHE_NAME = 'RuleParameters';

export const configs: RuleConfig[] = [
  {
    id: '003@1.0.0',
    cfg: '1.0.0',
    desc: 'Account dormancy - creditor',
    config: {
      parameters: {},
      exitConditions: [
        {
          subRuleRef: '.x01',
          reason: 'No verifiable creditor account activity detected',
        },
      ],
      bands: [
        {
          subRuleRef: '.01',
          upperLimit: 7889229000,
          reason: 'Creditor account not dormant in the last 3 months',
        },
        {
          subRuleRef: '.02',
          lowerLimit: 7889229000,
          upperLimit: 31556926000,
          reason: 'Creditor account dormant for between 3 and 12 months',
        },
        {
          subRuleRef: '.03',
          lowerLimit: 31556926000,
          reason: 'Creditor account dormant for more than 12 months',
        },
      ],
    },
  },
  {
    id: '008@1.0.0',
    cfg: '1.0.0',
    desc: 'Outgoing transfer similarity - creditor',
    config: {
      parameters: {
        maxQueryLimit: 3,
      },
      exitConditions: [
        {
          subRuleRef: '.x00',
          reason: 'Unsuccessful transaction',
        },
        {
          subRuleRef: '.x01',
          reason: 'Insufficient transaction history',
        },
      ],
      bands: [
        {
          subRuleRef: '.01',
          upperLimit: 2,
          reason: 'No recent transactions to the same creditor account',
        },
        {
          subRuleRef: '.02',
          lowerLimit: 2,
          upperLimit: 3,
          reason: 'Two recent transactions to the same creditor account',
        },
        {
          subRuleRef: '.03',
          lowerLimit: 3,
          reason:
            'Three or more recent transactions to the same creditor account',
        },
      ],
    },
  },
  {
    id: '010@1.0.0',
    cfg: '1.0.0',
    desc: 'Increased account activity: volume - debtor',
    config: {
      parameters: {
        evaluationIntervalTime: 86400000,
      },
      exitConditions: [
        {
          subRuleRef: '.x00',
          reason: 'Incoming transaction is unsuccessful',
        },
        {
          subRuleRef: '.x01',
          reason: 'Insufficient transaction history',
        },
        {
          subRuleRef: '.x03',
          reason:
            'No variance in transaction history and the volume of recent incoming transactions shows an increase for the debtor',
        },
        {
          subRuleRef: '.x04',
          reason:
            'No variance in transaction history and the volume of recent incoming transactions is less than or equal to the historical average for the debtor',
        },
      ],
      bands: [
        {
          subRuleRef: '.01',
          upperLimit: 2,
          reason:
            'The volume of recent outgoing transactions is within acceptable limits for the debtor',
        },
        {
          subRuleRef: '.02',
          lowerLimit: 2,
          upperLimit: 3,
          reason:
            'The volume of recent outgoing transactions shows a moderate increase for the debtor',
        },
        {
          subRuleRef: '.03',
          lowerLimit: 3,
          reason:
            'The volume of recent outgoing transactions shows a significant increase for the debtor',
        },
      ],
    },
  },
  {
    id: '011@1.0.0',
    cfg: '1.0.0',
    desc: 'Increased account activity: volume - creditor',
    config: {
      parameters: {
        evaluationIntervalTime: 86400000,
      },
      exitConditions: [
        {
          subRuleRef: '.x00',
          reason: 'Incoming transaction is unsuccessful',
        },
        {
          subRuleRef: '.x01',
          reason: 'Insufficient transaction history',
        },
        {
          subRuleRef: '.x03',
          reason:
            'No variance in transaction history and the volume of recent incoming transactions shows an increase for the creditor',
        },
        {
          subRuleRef: '.x04',
          reason:
            'No variance in transaction history and the volume of recent incoming transactions is less than or equal to the historical average for the creditor',
        },
      ],
      bands: [
        {
          subRuleRef: '.01',
          upperLimit: 2,
          reason:
            'The volume of recent incoming transactions is within acceptable limits for the creditor',
        },
        {
          subRuleRef: '.02',
          lowerLimit: 2,
          upperLimit: 3,
          reason:
            'The volume of recent incoming transactions shows a moderate increase for the creditor',
        },
        {
          subRuleRef: '.03',
          lowerLimit: 3,
          reason:
            'The volume of recent incoming transactions shows a significant increase for the creditor',
        },
      ],
    },
  },
  {
    id: '016@1.0.0',
    cfg: '1.0.0',
    desc: 'Transaction convergence - creditor',
    config: {
      parameters: {
        maxQueryRange: 86400000,
      },
      exitConditions: [],
      bands: [
        {
          subRuleRef: '.01',
          upperLimit: 5,
          reason: 'No Transaction convergence detected on creditor account',
        },
        {
          subRuleRef: '.02',
          lowerLimit: 5,
          reason: 'Transaction convergence detected on creditor account',
        },
      ],
    },
  },
  {
    id: '021@1.0.0',
    cfg: '1.0.0',
    desc: 'A large number of similar transaction amounts - creditor',
    config: {
      parameters: {
        maxQueryRange: 86400000,
        tolerance: 0.1,
      },
      exitConditions: [
        {
          subRuleRef: '.x00',
          reason: 'Unsuccessful transaction',
        },
        {
          subRuleRef: '.x01',
          reason: 'Insufficient transaction history',
        },
      ],
      bands: [
        {
          subRuleRef: '.01',
          upperLimit: 4,
          reason:
            'The creditor has received an insignificant number of transactions with the same amount in the last 24 hours',
        },
        {
          subRuleRef: '.02',
          lowerLimit: 4,
          reason:
            'The creditor has received a significant number of transactions with the same amount in the last 24 hours',
        },
      ],
    },
  },
  {
    id: '024@1.0.0',
    cfg: '1.0.0',
    desc: 'Non-commissioned transaction mirroring - creditor',
    config: {
      parameters: {
        maxQueryRange: 86400000,
        tolerance: 0.1,
      },
      exitConditions: [
        {
          subRuleRef: '.x00',
          reason: 'Unsuccessful transaction',
        },
        {
          subRuleRef: '.x01',
          reason: 'Insufficient transaction history',
        },
        {
          subRuleRef: '.x03',
          reason: 'No non-commissioned transaction mirroring detected',
        },
      ],
      bands: [
        {
          subRuleRef: '.01',
          upperLimit: 2,
          reason: 'Immediate non-commissioned transaction mirroring detected',
        },
        {
          subRuleRef: '.02',
          lowerLimit: 2,
          reason: 'Aggregated non-commissioned transaction mirroring detected',
        },
      ],
    },
  },
  {
    id: '026@1.0.0',
    cfg: '1.0.0',
    desc: 'Commissioned transaction mirroring - creditor',
    config: {
      parameters: {
        maxQueryRange: 86400000,
        commission: 0.1,
        tolerance: 0.1,
      },
      exitConditions: [
        {
          subRuleRef: '.x00',
          reason: 'Unsuccessful transaction',
        },
        {
          subRuleRef: '.x01',
          reason: 'Insufficient transaction history',
        },
        {
          subRuleRef: '.x03',
          reason: 'No commissioned transaction mirroring detected',
        },
      ],
      bands: [
        {
          subRuleRef: '.01',
          upperLimit: 2,
          reason: 'Immediate commissioned transaction mirroring detected',
        },
        {
          subRuleRef: '.02',
          lowerLimit: 2,
          reason: 'Aggregated commissioned transaction mirroring detected',
        },
      ],
    },
  },
  {
    id: '028@1.0.0',
    cfg: '1.0.0',
    desc: 'Age classification - debtor',
    config: {
      parameters: {},
      exitConditions: [],
      bands: [
        {
          subRuleRef: '.01',
          lowerLimit: 0,
          upperLimit: 18,
          reason: 'The debtor is younger than 18 years old',
        },
        {
          subRuleRef: '.02',
          lowerLimit: 18,
          upperLimit: 30,
          reason:
            'The debtor is 18 years or older and younger than 30 years of age',
        },
        {
          subRuleRef: '.03',
          lowerLimit: 30,
          upperLimit: 50,
          reason:
            'The debtor is 30 years or older and younger than 50 years of age',
        },
        {
          subRuleRef: '.04',
          lowerLimit: 50,
          reason: 'The debtor is 50 years or older',
        },
      ],
    },
  },
  {
    id: '030@1.0.0',
    cfg: '1.0.0',
    desc: 'Transfer to unfamiliar creditor account - debtor',
    config: {
      parameters: {},
      exitConditions: [
        {
          subRuleRef: '.x00',
          reason: 'Unsuccessful transaction',
        },
      ],
      bands: [
        {
          subRuleRef: '.01',
          upperLimit: 2,
          reason:
            'First successful payment from this debtor to creditor account',
        },
        {
          subRuleRef: '.02',
          lowerLimit: 2,
          upperLimit: 3,
          reason:
            'Second successful payment from this debtor to creditor account',
        },
        {
          subRuleRef: '.03',
          lowerLimit: 3,
          reason:
            'Third or more successful payment from this debtor to creditor account',
        },
      ],
    },
  },
  {
    id: '045@1.0.0',
    cfg: '1.0.0',
    desc: 'Successful transactions to the creditor, including the new transaction',
    config: {
      parameters: {},
      exitConditions: [],
      bands: [
        {
          subRuleRef: '.01',
          upperLimit: 1,
          reason:
            'To date, no successful payments have been made to creditor account',
        },
        {
          subRuleRef: '.02',
          lowerLimit: 1,
          upperLimit: 2,
          reason:
            'To date, one successful payment has been made to creditor account',
        },
        {
          subRuleRef: '.03',
          lowerLimit: 2,
          upperLimit: 3,
          reason:
            'To date, two successful payments have been made to creditor account',
        },
        {
          subRuleRef: '.04',
          lowerLimit: 3,
          reason:
            'To date, more than two successful payments have been made to creditor account',
        },
      ],
    },
  },
  {
    id: '048@1.0.0',
    cfg: '1.0.0',
    desc: 'Large transaction amount vs history - debtor',
    config: {
      parameters: {},
      exitConditions: [
        {
          subRuleRef: '.x00',
          reason: 'Incoming transaction is unsuccessful',
        },
        {
          subRuleRef: '.x01',
          reason: 'Insufficient transaction history',
        },
        {
          subRuleRef: '.x03',
          reason:
            'No variance in transaction history and the amount of the incoming transactions shows an increase for the debtor',
        },
        {
          subRuleRef: '.x04',
          reason:
            'No variance in transaction history and the amount of the incoming transactions is less than or equal to the historical average for the debtor',
        },
      ],
      bands: [
        {
          subRuleRef: '.01',
          upperLimit: 2,
          reason:
            'The amount of the outgoing transaction is within acceptable limits for the debtor',
        },
        {
          subRuleRef: '.02',
          lowerLimit: 2,
          upperLimit: 3,
          reason:
            'The amount of the outgoing transaction shows a moderate increase for the debtor',
        },
        {
          subRuleRef: '.03',
          lowerLimit: 3,
          reason:
            'The amount of the outgoing transaction shows a significant increase for the debtor',
        },
      ],
    },
  },
  {
    id: '063@1.0.0',
    cfg: '1.0.0',
    // eslint-disable-next-line @stylistic/quotes
    desc: "Synthetic data check - Benford's Law - creditor",
    config: {
      parameters: {
        minimumNumberOfTransactions: 50,
      },
      exitConditions: [
        {
          subRuleRef: '.x00',
          reason: 'Incoming transaction is unsuccessful',
        },
        {
          subRuleRef: '.x01',
          reason: 'At least 50 historical transactions required',
        },
      ],
      bands: [
        {
          subRuleRef: '.01',
          upperLimit: 15.507,
          reason:
            'Benfords Law: Creditor transaction history indicates a low probability of fictitious amounts',
        },
        {
          subRuleRef: '.02',
          lowerLimit: 15.507,
          reason:
            'Benfords Law: Creditor transaction history indicates a high probability of fictitious amounts',
        },
      ],
    },
  },
  {
    id: '084@1.0.0',
    cfg: '1.0.0',
    desc: 'Multiple accounts associated with a creditor',
    config: {
      parameters: {},
      exitConditions: [],
      bands: [
        {
          subRuleRef: '.01',
          upperLimit: 2,
          reason: 'Creditor has only one account',
        },
        {
          subRuleRef: '.02',
          lowerLimit: 2,
          reason: 'Creditor has more one account',
        },
      ],
    },
  },
];
