import { DailyResult } from './types';

export type DailySansModel = Omit<DailyResult, 'model'>;

export function stripModel(d: DailyResult): DailySansModel {
  const { model: _m, ...rest } = d;
  void _m;
  return rest;
}

