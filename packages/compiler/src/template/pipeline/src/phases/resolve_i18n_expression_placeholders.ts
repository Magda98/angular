/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ir from '../../ir';
import {ComponentCompilationJob} from '../compilation';

/**
 * Resolve the i18n expression placeholders in i18n messages.
 */
export function resolveI18nExpressionPlaceholders(job: ComponentCompilationJob) {
  // Record all of the i18n context ops, and the sub-template index for each i18n op.
  const subTemplateIndicies = new Map<ir.XrefId, number|null>();
  const i18nContexts = new Map<ir.XrefId, ir.I18nContextOp>();
  for (const unit of job.units) {
    for (const op of unit.create) {
      switch (op.kind) {
        case ir.OpKind.I18nStart:
          subTemplateIndicies.set(op.xref, op.subTemplateIndex);
          break;
        case ir.OpKind.I18nContext:
          i18nContexts.set(op.xref, op);
          break;
      }
    }
  }

  // Keep track of the next available expression index for each i18n message.
  const expressionIndices = new Map<ir.XrefId, number>();

  // Keep track of a reference index for each expression.
  // We use different references for normal i18n expressio and attribute i18n expressions. This is
  // because child i18n blocks in templates don't get their own context, since they're rolled into
  // the translated message of the parent, but they may target a different slot.
  const referenceIndex = (op: ir.I18nExpressionOp): ir.XrefId =>
      op.usage === ir.I18nExpressionFor.I18nText ? op.i18nOwner : op.context;

  for (const unit of job.units) {
    for (const op of unit.update) {
      if (op.kind === ir.OpKind.I18nExpression) {
        const i18nContext = i18nContexts.get(op.context)!;
        const index = expressionIndices.get(referenceIndex(op)) || 0;
        const subTemplateIndex = subTemplateIndicies.get(op.i18nOwner) ?? null;
        // Add the expression index in the appropriate params map.
        const params = op.resolutionTime === ir.I18nParamResolutionTime.Creation ?
            i18nContext.params :
            i18nContext.postprocessingParams;
        const values = params.get(op.i18nPlaceholder) || [];
        values.push({
          value: index,
          subTemplateIndex: subTemplateIndex,
          flags: ir.I18nParamValueFlags.ExpressionIndex
        });
        params.set(op.i18nPlaceholder, values);

        expressionIndices.set(referenceIndex(op), index + 1);
      }
    }
  }
}
