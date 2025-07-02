// SPDX-License-Identifier: Apache-2.0
import {
  type NetworkMap,
  type RuleConfig,
  type RuleResult,
} from '@tazama-lf/frms-coe-lib/lib/interfaces';
import apm from '../apm';
import { databaseManager, loggerService, server } from '..';
import { configuration } from '../';
import determineOutcome from '../helpers/determineOutcome';
import { getRuleConfig } from '../helpers/getRuleConfig';
import { handleRule003 } from '../rules/003';
import { handleRule008 } from '../rules/008';
import { handleRule010 } from '../rules/010';
import { handleRule011 } from '../rules/011';
import { handleRule016 } from '../rules/016';
import { handleRule021 } from '../rules/021';
import { handleRule024 } from '../rules/024';
import { handleRule026 } from '../rules/026';
import { handleRule028 } from '../rules/028';
//import { handleRule030 } from '../rules/030';
// import { handleRule048 } from '../rules/048';
// import { handleRule063 } from '../rules/063';
// import { handleRule084 } from '../rules/084';

const calculateDuration = (startTime: bigint): number => {
  const endTime: bigint = process.hrtime.bigint();
  return Number(endTime - startTime);
};

export const execute = async (reqObj: unknown): Promise<void> => {
  let request;
  let traceParent = '';
  let context = `Rule-${configuration.RULE_NAME} execute()`;
  loggerService.log(
    'Start - Handle execute request',
    context,
    configuration.functionName,
  );
  const startTime = process.hrtime.bigint();

  // Get required information from the incoming request
  try {
    // eslint-disable-next-line eslint-comments/disable-enable-pair
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const message = reqObj as any;
    request = {
      transaction: message.transaction,
      networkMap: message.networkMap as NetworkMap,
      DataCache: message.DataCache,
      metaData: message?.metaData,
    };
    traceParent = request.metaData?.traceParent;
  } catch (err) {
    const failMessage = 'Failed to parse execution request.';
    loggerService.error(failMessage, err, context, configuration.functionName);
    loggerService.log(
      'End - Handle execute request',
      context,
      configuration.functionName,
    );
    return;
  }
  const apmTransaction = apm.startTransaction(
    `rule.process.${configuration.RULE_NAME}`,
    {
      childOf: traceParent,
    },
  );

  let ruleRes: RuleResult = {
    id: `${configuration.RULE_NAME}@${configuration.RULE_VERSION}`,
    cfg: '',
    subRuleRef: '.err',
    reason: 'Unhandled rule result outcome',
    prcgTm: -1,
  };

  context = ruleRes.id;

  ruleRes.cfg = (() => {
    for (const messages of request.networkMap.messages) {
      for (const typologies of messages.typologies) {
        for (const rule of typologies.rules) {
          if (rule.id === ruleRes.id) {
            return rule.cfg;
          }
        }
      }
    }
    return '';
  })();

  let ruleConfig: RuleConfig | undefined;
  const spanRuleConfig = apm.startSpan(`db.get.ruleconfig.${ruleRes.id}`);
  try {
    if (!ruleRes.cfg) throw new Error('Rule not found in network map');
    ruleConfig = await getRuleConfig(ruleRes.id, ruleRes.cfg);

    spanRuleConfig?.end();
    if (!ruleConfig) {
      throw new Error('Rule processor configuration not retrievable');
    }
  } catch (error) {
    spanRuleConfig?.end();
    loggerService.error(
      'Error while getting rule configuration',
      error,
      context,
      configuration.functionName,
    );
    ruleRes.prcgTm = calculateDuration(startTime);
    ruleRes = {
      ...ruleRes,
      subRuleRef: '.err',
      reason: (error as Error).message,
    };
    const spanHandleResponse = apm.startSpan(
      `handleResponse.${ruleRes.id}.err`,
    );
    await server.handleResponse({
      transaction: request.transaction,
      ruleResult: ruleRes,
      networkMap: request.networkMap,
    });
    spanHandleResponse?.end();
    return;
  }

  const span = apm.startSpan(`rule.${ruleRes.id}.findResult`);
  try {
    loggerService.trace('Execute rule logic', context);
    switch (ruleRes.id.split('@')[0]) {
      case '003':
        ruleRes = await handleRule003(
          request,
          determineOutcome,
          ruleRes,
          loggerService,
          ruleConfig,
          databaseManager,
        );
        break;
      case '008':
        ruleRes = await handleRule008(
          request,
          determineOutcome,
          ruleRes,
          loggerService,
          ruleConfig,
          databaseManager,
        );
        break;
      case '010':
        ruleRes = await handleRule010(
          request,
          determineOutcome,
          ruleRes,
          loggerService,
          ruleConfig,
          databaseManager,
        );
        break;
      case '011':
        ruleRes = await handleRule011(
          request,
          determineOutcome,
          ruleRes,
          loggerService,
          ruleConfig,
          databaseManager,
        );
        break;
      case '016':
        ruleRes = await handleRule016(
          request,
          determineOutcome,
          ruleRes,
          loggerService,
          ruleConfig,
          databaseManager,
        );
        break;
      case '021':
        ruleRes = await handleRule021(
          request,
          determineOutcome,
          ruleRes,
          loggerService,
          ruleConfig,
          databaseManager,
        );
        break;
      case '024':
        ruleRes = await handleRule024(
          request,
          determineOutcome,
          ruleRes,
          loggerService,
          ruleConfig,
          databaseManager,
        );
        break;
      case '026':
        ruleRes = await handleRule026(
          request,
          determineOutcome,
          ruleRes,
          loggerService,
          ruleConfig,
          databaseManager,
        );
        break;
      case '028':
        ruleRes = await handleRule028(
          request,
          determineOutcome,
          ruleRes,
          loggerService,
          ruleConfig,
          databaseManager,
        );
        break;
      // case '030':
      //   ruleRes = await handleRule030(
      //     request,
      //     determineOutcome,
      //     ruleRes,
      //     loggerService,
      //     ruleConfig,
      //     databaseManager,
      //   );
      //   break;
      // case '048':
      //   ruleRes = await handleRule048(
      //     request,
      //     determineOutcome,
      //     ruleRes,
      //     loggerService,
      //     ruleConfig,
      //     databaseManager,
      //   );
      //   break;
      // case '063':
      //   ruleRes = await handleRule063(
      //     request,
      //     determineOutcome,
      //     ruleRes,
      //     loggerService,
      //     ruleConfig,
      //     databaseManager,
      //   );
      //   break;
      // case '084':
      //   ruleRes = await handleRule084(
      //     request,
      //     determineOutcome,
      //     ruleRes,
      //     loggerService,
      //     ruleConfig,
      //     databaseManager,
      //   );
      //   break;
      default:
        loggerService.log(`cannot map rule res id ${ruleRes.id}`);
    }

    span?.end();
  } catch (error) {
    span?.end();
    const failMessage = 'Failed to process execution request.';
    loggerService.error(
      failMessage,
      error,
      context,
      configuration.functionName,
    );
    ruleRes = {
      ...ruleRes,
      subRuleRef: '.err',
      reason: (error as Error).message,
    };
  } finally {
    ruleRes.prcgTm = calculateDuration(startTime);
    loggerService.log(
      'End - Handle execute request',
      context,
      configuration.functionName,
    );
  }

  const spanResponse = apm.startSpan(`send.to.typroc.${ruleRes.id}`);
  try {
    request.metaData.traceParent = apm.getCurrentTraceparent();
    // happy path, we don't need reason
    if (ruleRes.reason) {
      loggerService.log(ruleRes.reason, context);
    }
    if (ruleRes.subRuleRef !== '.err') {
      // happy path, we don't need reason
      delete ruleRes.reason;
    }

    await server.handleResponse({
      ...request,
      ruleResult: ruleRes,
    });
  } catch (error) {
    const failMessage = 'Failed to send to Typology Processor.';
    loggerService.error(
      failMessage,
      error,
      context,
      configuration.functionName,
    );
    ruleRes = {
      ...ruleRes,
      subRuleRef: '.err',
      reason: (error as Error).message,
    };
  } finally {
    spanResponse?.end();
  }
  apmTransaction?.end();
};
