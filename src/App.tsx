// 页面：整理入库台，只负责展示与交互，判定走 domain，存取走 store

import { useMemo, useState } from "react";
import "./styles.css";
import {
  conditionOptions,
  transferManifests,
  type IntakeRecord,
  type IntakeSnapshot,
  type StorageEntry,
} from "./data/intakeData";
import {
  canStore,
  correctStorage,
  createRepairOrder,
  passReinspection,
  reconcileIntake,
  registerIntake,
  storeIntake,
  summarize,
  type IntakeDraft,
} from "./domain/intakeRules";
import { loadSnapshot, nextId, resetSnapshot, saveSnapshot, today } from "./store/intakeStore";

const emptyDraft: IntakeDraft = {
  batchNo: "",
  trench: "",
  layer: "",
  coordinates: "",
  count: 1,
  condition: conditionOptions[0],
  receiver: "",
  receivedAt: today(),
};

function MetricCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={tone} />
    </article>
  );
}

function App() {
  const [snapshot, setSnapshot] = useState<IntakeSnapshot>(loadSnapshot);
  const [draft, setDraft] = useState<IntakeDraft>(emptyDraft);
  const [formError, setFormError] = useState("");
  const [action, setAction] = useState<{ kind: string; id: string } | null>(null);
  const [actionFields, setActionFields] = useState<Record<string, string>>({});
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  const metrics = useMemo(() => summarize(snapshot), [snapshot]);
  const pendingList = snapshot.intakes.filter((r) => r.status === "待核");
  const readyList = snapshot.intakes.filter((r) => r.status === "待入库");
  const repairList = snapshot.repairs;

  function commit(next: IntakeSnapshot) {
    setSnapshot(next);
    saveSnapshot(next);
    setAction(null);
    setActionFields({});
  }

  function field(key: string, fallback = "") {
    return actionFields[key] ?? fallback;
  }

  function submitIntake() {
    if (!draft.batchNo.trim() || !draft.trench.trim() || !draft.receiver.trim()) {
      setFormError("送检批号、探方、接收人必填");
      return;
    }
    if (draft.count < 1) {
      setFormError("件数至少为 1");
      return;
    }
    const record = registerIntake(draft, transferManifests, snapshot.intakes, nextId("js"));
    setFormError("");
    setDraft({ ...emptyDraft, receivedAt: today() });
    commit({ ...snapshot, intakes: [record, ...snapshot.intakes] });
  }

  function doReconcile(record: IntakeRecord) {
    const next = reconcileIntake(record, field("note"));
    commit({
      ...snapshot,
      intakes: snapshot.intakes.map((r) => (r.id === record.id ? next : r)),
    });
  }

  function doCreateRepair(record: IntakeRecord) {
    if (!field("missingPart").trim() || !field("handler").trim()) return;
    const { record: updated, order } = createRepairOrder(
      record,
      field("missingPart"),
      field("handler"),
      field("note"),
      nextId("xf"),
      today()
    );
    commit({
      ...snapshot,
      intakes: snapshot.intakes.map((r) => (r.id === record.id ? updated : r)),
      repairs: [order, ...snapshot.repairs],
    });
  }

  function doPassReinspection(orderId: string) {
    const order = snapshot.repairs.find((r) => r.id === orderId);
    const record = snapshot.intakes.find((r) => r.id === order?.intakeId);
    if (!order || !record) return;
    const result = passReinspection(order, record);
    commit({
      ...snapshot,
      intakes: snapshot.intakes.map((r) => (r.id === record.id ? result.record : r)),
      repairs: snapshot.repairs.map((r) => (r.id === order.id ? result.order : r)),
    });
  }

  function doStore(record: IntakeRecord) {
    const blocked = canStore(record, snapshot.repairs);
    if (blocked || !field("location").trim() || !field("operator").trim()) return;
    const { record: updated, entry } = storeIntake(record, field("location"), field("operator"), today());
    commit({
      ...snapshot,
      intakes: snapshot.intakes.map((r) => (r.id === record.id ? updated : r)),
      storage: [entry, ...snapshot.storage],
    });
  }

  function doCorrect(entry: StorageEntry) {
    const count = Number(field("count", String(entry.current.count)));
    if (!field("location", entry.current.location).trim() || !field("reason").trim() || !field("operator").trim()) {
      return;
    }
    if (!Number.isInteger(count) || count < 0) return;
    const next = correctStorage(entry, count, field("location", entry.current.location), field("reason"), field("operator"), today());
    commit({ ...snapshot, storage: snapshot.storage.map((e) => (e.intakeId === entry.intakeId ? next : e)) });
  }

  function renderIntakeRow(record: IntakeRecord, zone: "待核" | "待入库") {
    const busy = action?.id === record.id;
    return (
      <article key={record.id} className="record-card">
        <div className="record-index">{record.batchNo.replace("PJ-", "")}</div>
        <div className="record-body">
          <h3>
            {record.batchNo} · {record.trench} · {record.layer}
            <span className={`tag tag-${record.status}`}>{record.status}</span>
          </h3>
          <p>
            坐标 {record.coordinates} · 实收 {record.count} 件 · {record.condition} · 接收人 {record.receiver} ·{" "}
            {record.receivedAt}
          </p>
          {record.mismatchReasons.length > 0 && (
            <ul className="mismatch-list">
              {record.mismatchReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}

          {zone === "待核" && !busy && (
            <div className="row-actions">
              <button className="primary-action" onClick={() => setAction({ kind: "reconcile", id: record.id })}>
                核对移交单后放行
              </button>
            </div>
          )}
          {zone === "待核" && action?.kind === "reconcile" && busy && (
            <div className="action-form">
              <input
                placeholder="复核说明（已与移交单 YJ-2026-×× 核对…）"
                value={field("note")}
                onChange={(e) => setActionFields({ ...actionFields, note: e.target.value })}
              />
              <button className="primary-action" onClick={() => doReconcile(record)}>
                确认放行
              </button>
              <button onClick={() => setAction(null)}>取消</button>
            </div>
          )}

          {zone === "待入库" && !busy && (
            <div className="row-actions">
              <button onClick={() => setAction({ kind: "repair", id: record.id })}>缺件转修复单</button>
              <button className="primary-action" onClick={() => setAction({ kind: "store", id: record.id })}>
                确认入库
              </button>
            </div>
          )}
          {zone === "待入库" && action?.kind === "repair" && busy && (
            <div className="action-form">
              <input
                placeholder="缺失部位（如：陶罐口沿缺失）"
                value={field("missingPart")}
                onChange={(e) => setActionFields({ ...actionFields, missingPart: e.target.value })}
              />
              <input
                placeholder="处理人"
                value={field("handler")}
                onChange={(e) => setActionFields({ ...actionFields, handler: e.target.value })}
              />
              <input
                placeholder="备注（可选）"
                value={field("note")}
                onChange={(e) => setActionFields({ ...actionFields, note: e.target.value })}
              />
              <button className="primary-action" onClick={() => doCreateRepair(record)}>
                开出修复单
              </button>
              <button onClick={() => setAction(null)}>取消</button>
            </div>
          )}
          {zone === "待入库" && action?.kind === "store" && busy && (
            <div className="action-form">
              <input
                placeholder="库位（如：A架-02-03）"
                value={field("location")}
                onChange={(e) => setActionFields({ ...actionFields, location: e.target.value })}
              />
              <input
                placeholder="经办人"
                value={field("operator")}
                onChange={(e) => setActionFields({ ...actionFields, operator: e.target.value })}
              />
              <button className="primary-action" onClick={() => doStore(record)}>
                定版入库
              </button>
              <button onClick={() => setAction(null)}>取消</button>
            </div>
          )}
        </div>
      </article>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-10 · 整理入库台</p>
          <h1>出土器物整理入库台</h1>
          <p className="subtitle">
            陶片、骨器送到后在此接收登记：与移交单逐批核对，对不上留待核区；缺件转修复单，复验前不进正式库位；入库后件数与库位定版，更正另建原因版本，旧值可查。
          </p>
        </div>
        <div className="stack-card">
          <span>今日待办</span>
          <strong>
            待核 {metrics.pending} 批 · 修复中 {metrics.repairing} 单
          </strong>
          <button onClick={() => commit(resetSnapshot())}>恢复示例数据</button>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard label="待核批数" value={metrics.pending} tone="status-danger" />
        <MetricCard label="修复中单" value={metrics.repairing} tone="status-watch" />
        <MetricCard label="已入库批" value={metrics.storedBatches} tone="status-ok" />
        <MetricCard label="库内总件数" value={metrics.storedPieces} tone="status-ok" />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>接收登记</p>
            <h2>登记送检批</h2>
          </div>
          <button className="primary-action" onClick={submitIntake}>
            登记并核对移交单
          </button>
        </div>
        <div className="field-grid">
          <label>
            <span>送检批号</span>
            <input
              placeholder="如 PJ-045"
              value={draft.batchNo}
              onChange={(e) => setDraft({ ...draft, batchNo: e.target.value })}
            />
          </label>
          <label>
            <span>探方</span>
            <input
              placeholder="如 T0203"
              value={draft.trench}
              onChange={(e) => setDraft({ ...draft, trench: e.target.value })}
            />
          </label>
          <label>
            <span>地层</span>
            <input
              placeholder="如 第3层 / H12灰坑"
              value={draft.layer}
              onChange={(e) => setDraft({ ...draft, layer: e.target.value })}
            />
          </label>
          <label>
            <span>坐标</span>
            <input
              placeholder="如 E3N4"
              value={draft.coordinates}
              onChange={(e) => setDraft({ ...draft, coordinates: e.target.value })}
            />
          </label>
          <label>
            <span>件数</span>
            <input
              type="number"
              min={1}
              value={draft.count}
              onChange={(e) => setDraft({ ...draft, count: Number(e.target.value) })}
            />
          </label>
          <label>
            <span>保存状况</span>
            <select value={draft.condition} onChange={(e) => setDraft({ ...draft, condition: e.target.value })}>
              {conditionOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            <span>接收人</span>
            <input
              placeholder="接收人姓名"
              value={draft.receiver}
              onChange={(e) => setDraft({ ...draft, receiver: e.target.value })}
            />
          </label>
          <label>
            <span>接收日期</span>
            <input
              type="date"
              value={draft.receivedAt}
              onChange={(e) => setDraft({ ...draft, receivedAt: e.target.value })}
            />
          </label>
        </div>
        {formError && <p className="form-error">{formError}</p>}
        <p className="hint">
          登记即与移交单底账核对：批号或坐标对不上，自动留待核区，不会进入待入库。
        </p>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>待核区</p>
            <h2>与移交单对不上的批次（{pendingList.length}）</h2>
          </div>
        </div>
        <div className="record-list">
          {pendingList.length === 0 && <p className="hint">待核区已清空。</p>}
          {pendingList.map((record) => renderIntakeRow(record, "待核"))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>待入库</p>
            <h2>核对无误，待处理的批次（{readyList.length}）</h2>
          </div>
        </div>
        <div className="record-list">
          {readyList.length === 0 && <p className="hint">暂无待入库批次。</p>}
          {readyList.map((record) => renderIntakeRow(record, "待入库"))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>修复单</p>
            <h2>缺件修复与复验（{repairList.length}）</h2>
          </div>
        </div>
        <div className="record-list">
          {repairList.length === 0 && <p className="hint">暂无修复单。</p>}
          {repairList.map((order) => (
            <article key={order.id} className="record-card">
              <div className="record-index repair">{order.batchNo.replace("PJ-", "")}</div>
              <div className="record-body">
                <h3>
                  {order.batchNo} · 缺失部位：{order.missingPart}
                  <span className={`tag tag-${order.status}`}>{order.status}</span>
                </h3>
                <p>
                  处理人 {order.handler} · 开单 {order.createdAt}
                  {order.note && ` · 备注：${order.note}`}
                </p>
                {order.status === "修复中" && (
                  <>
                    <p className="hint">复验前该批不能进正式库位。</p>
                    <div className="row-actions">
                      <button className="primary-action" onClick={() => doPassReinspection(order.id)}>
                        复验通过
                      </button>
                    </div>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>正式库位</p>
            <h2>已入库批次（{snapshot.storage.length}）</h2>
          </div>
        </div>
        <div className="record-list">
          {snapshot.storage.map((entry) => {
            const busy = action?.id === entry.intakeId;
            const expanded = expandedHistory === entry.intakeId;
            return (
              <article key={entry.intakeId} className="record-card">
                <div className="record-index stored">{entry.batchNo.replace("PJ-", "")}</div>
                <div className="record-body">
                  <h3>
                    {entry.batchNo} · {entry.current.location}
                    <span className="tag tag-已入库">第 {entry.current.version} 版</span>
                  </h3>
                  <p>
                    件数 {entry.current.count} · {entry.current.reason} · {entry.current.changedBy} ·{" "}
                    {entry.current.changedAt}
                  </p>
                  {!busy && (
                    <div className="row-actions">
                      <button
                        onClick={() => {
                          setAction({ kind: "correct", id: entry.intakeId });
                          setActionFields({
                            count: String(entry.current.count),
                            location: entry.current.location,
                            reason: "",
                            operator: "",
                          });
                        }}
                      >
                        更正（另建版本）
                      </button>
                      {entry.history.length > 0 && (
                        <button onClick={() => setExpandedHistory(expanded ? null : entry.intakeId)}>
                          {expanded ? "收起历史" : `历史版本（${entry.history.length}）`}
                        </button>
                      )}
                    </div>
                  )}
                  {busy && action?.kind === "correct" && (
                    <div className="action-form">
                      <input
                        type="number"
                        min={0}
                        placeholder="更正后件数"
                        value={field("count", String(entry.current.count))}
                        onChange={(e) => setActionFields({ ...actionFields, count: e.target.value })}
                      />
                      <input
                        placeholder="更正后库位"
                        value={field("location", entry.current.location)}
                        onChange={(e) => setActionFields({ ...actionFields, location: e.target.value })}
                      />
                      <input
                        placeholder="更正原因（必填）"
                        value={field("reason")}
                        onChange={(e) => setActionFields({ ...actionFields, reason: e.target.value })}
                      />
                      <input
                        placeholder="经办人"
                        value={field("operator")}
                        onChange={(e) => setActionFields({ ...actionFields, operator: e.target.value })}
                      />
                      <button className="primary-action" onClick={() => doCorrect(entry)}>
                        存为新版本
                      </button>
                      <button onClick={() => setAction(null)}>取消</button>
                    </div>
                  )}
                  {expanded && (
                    <ul className="history-list">
                      {entry.history.map((version) => (
                        <li key={version.version}>
                          第 {version.version} 版 · 件数 {version.count} · {version.location} · {version.reason} ·{" "}
                          {version.changedBy} · {version.changedAt}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export default App;
