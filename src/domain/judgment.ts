// 判定：接收比对、状态推导、入库门槛与版本追加，全部为纯函数

import type {
  Accession,
  AccessionVersion,
  Condition,
  IntakeRecord,
  IntakeStatus,
  RepairOrder,
  TransferSlip,
} from "../types";

export interface IntakeInput {
  batchNo: string;
  trench: string;
  layer: string;
  coordinates: string;
  count: number;
  condition: Condition;
  receiver: string;
}

/** 接收登记与移交单底账逐字段比对，返回对不上的原因（空数组 = 通过） */
export function checkIntakeAgainstSlips(input: IntakeInput, slips: TransferSlip[]): string[] {
  const slip = slips.find((s) => s.batchNo === input.batchNo.trim());
  if (!slip) {
    return [`批号 ${input.batchNo.trim() || "（空）"} 不在移交单底账中`];
  }
  const reasons: string[] = [];
  if (slip.trench !== input.trench.trim()) {
    reasons.push(`探方不符：登记 ${input.trench.trim()}，移交单 ${slip.trench}`);
  }
  if (slip.layer !== input.layer.trim()) {
    reasons.push(`地层不符：登记 ${input.layer.trim()}，移交单 ${slip.layer}`);
  }
  if (slip.coordinates !== input.coordinates.trim()) {
    reasons.push(`坐标不符：登记 ${input.coordinates.trim()}，移交单 ${slip.coordinates}`);
  }
  if (slip.count !== input.count) {
    reasons.push(`件数不符：登记 ${input.count} 件，移交单 ${slip.count} 件`);
  }
  return reasons;
}

/** 该接收记录下是否有未复验的修复单 */
export function hasOpenRepair(orders: RepairOrder[], intakeId: string): boolean {
  return orders.some((o) => o.intakeId === intakeId && o.state === "repairing");
}

export function findAccession(accessions: Accession[], intakeId: string): Accession | undefined {
  return accessions.find((a) => a.intakeId === intakeId);
}

/** 状态推导：待核 > 修复中 > 已入库 > 待入库 */
export function intakeStatus(
  record: IntakeRecord,
  orders: RepairOrder[],
  accessions: Accession[]
): IntakeStatus {
  if (record.holdReasons.length > 0) return "hold";
  if (hasOpenRepair(orders, record.id)) return "repair";
  if (findAccession(accessions, record.id)) return "stored";
  return "ready";
}

/** 入库门槛：返回不能入库的原因，null 表示可以入库 */
export function accessionBlockReason(
  record: IntakeRecord,
  orders: RepairOrder[],
  accessions: Accession[]
): string | null {
  const status = intakeStatus(record, orders, accessions);
  if (status === "hold") return "批号或坐标与移交单对不上，仍在待核区";
  if (status === "repair") return "修复单未复验，复验前不能进正式库位";
  if (status === "stored") return "已入库，件数与库位以最新版本为准";
  return null;
}

/** 追加入库版本：更正不覆盖旧值，版本号递增 */
export function nextVersion(
  versions: AccessionVersion[],
  input: { count: number; location: string; reason: string; operator: string },
  at: string
): AccessionVersion {
  return { version: versions.length + 1, ...input, at };
}

export function currentVersion(accession: Accession): AccessionVersion {
  return accession.versions[accession.versions.length - 1];
}

/** 看板指标 */
export function summarize(state: {
  intakes: IntakeRecord[];
  repairs: RepairOrder[];
  accessions: Accession[];
}) {
  const hold = state.intakes.filter((r) => r.holdReasons.length > 0).length;
  const repairing = state.repairs.filter((o) => o.state === "repairing").length;
  const storedCount = state.accessions.reduce((sum, a) => sum + currentVersion(a).count, 0);
  return {
    接收批数: state.intakes.length,
    待核: hold,
    修复中: repairing,
    已入库件数: storedCount,
  };
}
