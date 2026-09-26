// 领域类型：整理入库台共用

export type Condition = "完好" | "残损" | "缺件" | "待清理";

/** 移交单：发掘队随批移交的原始凭证，验收时逐字段比对 */
export interface TransferSlip {
  batchNo: string; // 送检批号
  trench: string; // 探方
  layer: string; // 地层
  coordinates: string; // 坐标点
  count: number; // 移交件数
  deliverer: string; // 移交方
}

/** 接收登记记录 */
export interface IntakeRecord {
  id: string;
  batchNo: string;
  trench: string;
  layer: string;
  coordinates: string;
  count: number;
  condition: Condition;
  receiver: string; // 接收人
  receivedAt: string;
  /** 非空即留在待核区：批号或坐标与移交单对不上的原因 */
  holdReasons: string[];
}

export type IntakeStatus = "hold" | "repair" | "ready" | "stored";

/** 修复单：缺件器物复验前不得进正式库位 */
export interface RepairOrder {
  id: string;
  intakeId: string;
  missingPart: string; // 缺失部位
  handler: string; // 处理人
  createdAt: string;
  state: "repairing" | "rechecked"; // 修复中 / 复验通过
  note?: string;
}

/** 入库版本：件数与库位的一次确定值，更正只追加新版本 */
export interface AccessionVersion {
  version: number;
  count: number;
  location: string; // 库位
  reason: string; // 首次入库 / 更正原因
  operator: string;
  at: string;
}

export interface Accession {
  intakeId: string;
  versions: AccessionVersion[];
}

export interface WorkbenchState {
  intakes: IntakeRecord[];
  repairs: RepairOrder[];
  accessions: Accession[];
}
