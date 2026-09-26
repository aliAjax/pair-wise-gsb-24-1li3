// 页面：整理入库台。数据见 data/acceptance.ts，判定见 domain/judgment.ts，本地记录见 store/localRecords.ts
import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import {
  conditions,
  project,
  receivers,
  repairHandlers,
  storageLocations,
  transferSlips,
} from "./data/acceptance";
import {
  accessionBlockReason,
  checkIntakeAgainstSlips,
  currentVersion,
  findAccession,
  hasOpenRepair,
  intakeStatus,
  nextVersion,
  summarize,
  type IntakeInput,
} from "./domain/judgment";
import { loadState, resetState, saveState } from "./store/localRecords";
import type { Condition, IntakeRecord, IntakeStatus, WorkbenchState } from "./types";

const statusText: Record<IntakeStatus, string> = {
  hold: "待核",
  repair: "修复中",
  ready: "待入库",
  stored: "已入库",
};

function now(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nextId(prefix: string, existing: string[]): string {
  const max = existing.reduce((m, id) => {
    const n = Number(id.split("-")[1]);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

function StatusBadge({ status }: { status: IntakeStatus }) {
  return <span className={`badge badge-${status}`}>{statusText[status]}</span>;
}

function MetricCard({ label, value, index }: { label: string; value: number; index: number }) {
  const tones = ["status-ok", "status-danger", "status-watch", "status-ok"];
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={tones[index % tones.length]} />
    </article>
  );
}

/** 接收登记：提交后与移交单底账比对，对不上自动留待核区 */
function IntakeForm({ onRegister }: { onRegister: (input: IntakeInput) => void }) {
  const [form, setForm] = useState<IntakeInput>({
    batchNo: "",
    trench: "",
    layer: "",
    coordinates: "",
    count: 1,
    condition: "完好",
    receiver: receivers[0],
  });
  const set = (patch: Partial<IntakeInput>) => setForm((f) => ({ ...f, ...patch }));

  const fillFromSlip = (batchNo: string) => {
    const slip = transferSlips.find((s) => s.batchNo === batchNo);
    setForm((f) =>
      slip
        ? { ...f, batchNo, trench: slip.trench, layer: slip.layer, coordinates: slip.coordinates, count: slip.count }
        : { ...f, batchNo }
    );
  };

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>{project.domain}</p>
          <h2>接收登记</h2>
        </div>
      </div>
      <div className="field-grid">
        <label>
          <span>送检批号</span>
          <input
            list="slip-batches"
            value={form.batchNo}
            placeholder="如 YP-2026-014"
            onChange={(e) => fillFromSlip(e.target.value)}
          />
          <datalist id="slip-batches">
            {transferSlips.map((s) => (
              <option key={s.batchNo} value={s.batchNo} />
            ))}
          </datalist>
        </label>
        <label>
          <span>探方</span>
          <input value={form.trench} placeholder="如 T0203" onChange={(e) => set({ trench: e.target.value })} />
        </label>
        <label>
          <span>地层</span>
          <input value={form.layer} placeholder="如 第3层" onChange={(e) => set({ layer: e.target.value })} />
        </label>
        <label>
          <span>坐标点</span>
          <input value={form.coordinates} placeholder="如 E3N4" onChange={(e) => set({ coordinates: e.target.value })} />
        </label>
        <label>
          <span>件数</span>
          <input
            type="number"
            min={1}
            value={form.count}
            onChange={(e) => set({ count: Math.max(1, Number(e.target.value) || 1) })}
          />
        </label>
        <label>
          <span>保存状况</span>
          <select value={form.condition} onChange={(e) => set({ condition: e.target.value as Condition })}>
            {conditions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>接收人</span>
          <select value={form.receiver} onChange={(e) => set({ receiver: e.target.value })}>
            {receivers.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-footer">
        <p className="hint">提交后与移交单底账比对，批号或坐标对不上将自动留待核区。</p>
        <button className="primary-action" onClick={() => onRegister(form)}>
          登记接收
        </button>
      </div>
    </section>
  );
}

/** 待核区：批号或坐标与移交单对不上的记录 */
function HoldSection({
  records,
  onResolve,
  onReturn,
}: {
  records: IntakeRecord[];
  onResolve: (id: string) => void;
  onReturn: (id: string) => void;
}) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>与移交单对不上</p>
          <h2>待核区</h2>
        </div>
      </div>
      {records.length === 0 && <p className="empty">暂无待核记录。</p>}
      <div className="record-list">
        {records.map((r) => (
          <article key={r.id} className="record-card">
            <div className="record-index">{r.id.slice(-2)}</div>
            <div>
              <h3>
                {r.batchNo} · {r.trench} · {r.layer} <StatusBadge status="hold" />
              </h3>
              <p>
                {r.count} 件 · {r.condition} · 接收人 {r.receiver} · {r.receivedAt}
              </p>
              <ul className="reason-list">
                {r.holdReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <div className="row-actions">
                <button onClick={() => onResolve(r.id)}>复核通过（移交单已补正）</button>
                <button className="danger" onClick={() => onReturn(r.id)}>
                  退回移交方
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/** 修复单：缺件转修复，复验前不能进正式库位 */
function RepairSection({
  state,
  onCreate,
  onRecheck,
}: {
  state: WorkbenchState;
  onCreate: (intakeId: string, missingPart: string, handler: string) => void;
  onRecheck: (orderId: string) => void;
}) {
  const repairable = state.intakes.filter(
    (r) =>
      r.holdReasons.length === 0 &&
      !findAccession(state.accessions, r.id) &&
      !hasOpenRepair(state.repairs, r.id) &&
      (r.condition === "缺件" || r.condition === "残损")
  );
  const [intakeId, setIntakeId] = useState("");
  const [missingPart, setMissingPart] = useState("");
  const [handler, setHandler] = useState(repairHandlers[0]);

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>缺件转修复</p>
          <h2>修复单</h2>
        </div>
      </div>
      <div className="repair-form">
        <select value={intakeId} onChange={(e) => setIntakeId(e.target.value)}>
          <option value="">选择缺件/残损记录</option>
          {repairable.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id} · {r.batchNo} · {r.condition}
            </option>
          ))}
        </select>
        <input
          value={missingPart}
          placeholder="缺失部位，如：陶罐口沿缺失约1/4"
          onChange={(e) => setMissingPart(e.target.value)}
        />
        <select value={handler} onChange={(e) => setHandler(e.target.value)}>
          {repairHandlers.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <button
          className="primary-action"
          disabled={!intakeId || !missingPart.trim()}
          onClick={() => {
            onCreate(intakeId, missingPart.trim(), handler);
            setIntakeId("");
            setMissingPart("");
          }}
        >
          开修复单
        </button>
      </div>
      {state.repairs.length === 0 && <p className="empty">暂无修复单。</p>}
      <div className="record-list">
        {state.repairs.map((o) => {
          const intake = state.intakes.find((r) => r.id === o.intakeId);
          return (
            <article key={o.id} className="record-card">
              <div className="record-index">{o.id.slice(-2)}</div>
              <div>
                <h3>
                  {o.id} · {intake?.batchNo ?? o.intakeId}{" "}
                  <span className={`badge ${o.state === "repairing" ? "badge-repair" : "badge-stored"}`}>
                    {o.state === "repairing" ? "修复中" : "复验通过"}
                  </span>
                </h3>
                <p>
                  缺失部位：{o.missingPart} · 处理人 {o.handler} · {o.createdAt}
                </p>
                {o.note && <p>备注：{o.note}</p>}
                {o.state === "repairing" && (
                  <div className="row-actions">
                    <span className="hint">复验前不能进正式库位</span>
                    <button onClick={() => onRecheck(o.id)}>复验通过</button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** 入库台与版本：入库定件数库位，更正另建原因版本，旧值可查 */
function AccessionSection({
  state,
  onStore,
  onCorrect,
}: {
  state: WorkbenchState;
  onStore: (intakeId: string, count: number, location: string, operator: string) => void;
  onCorrect: (intakeId: string, count: number, location: string, reason: string, operator: string) => void;
}) {
  const ready = state.intakes.filter((r) => intakeStatus(r, state.repairs, state.accessions) === "ready");
  const stored = state.intakes.filter((r) => intakeStatus(r, state.repairs, state.accessions) === "stored");
  const blocked = state.intakes.filter((r) => {
    const s = intakeStatus(r, state.repairs, state.accessions);
    return s === "hold" || s === "repair";
  });

  const [intakeId, setIntakeId] = useState("");
  const [count, setCount] = useState(1);
  const [location, setLocation] = useState(storageLocations[0]);
  const [operator, setOperator] = useState(receivers[0]);

  const [correctId, setCorrectId] = useState("");
  const [correctCount, setCorrectCount] = useState(1);
  const [correctLocation, setCorrectLocation] = useState(storageLocations[0]);
  const [reason, setReason] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>件数与库位定版</p>
          <h2>入库台</h2>
        </div>
      </div>

      <div className="repair-form">
        <select
          value={intakeId}
          onChange={(e) => {
            const id = e.target.value;
            setIntakeId(id);
            const rec = ready.find((r) => r.id === id);
            if (rec) setCount(rec.count);
          }}
        >
          <option value="">选择可入库记录</option>
          {ready.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id} · {r.batchNo} · {r.count} 件
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          value={count}
          onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
          placeholder="入库件数"
        />
        <select value={location} onChange={(e) => setLocation(e.target.value)}>
          {storageLocations.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select value={operator} onChange={(e) => setOperator(e.target.value)}>
          {receivers.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          className="primary-action"
          disabled={!intakeId}
          onClick={() => {
            onStore(intakeId, count, location, operator);
            setIntakeId("");
          }}
        >
          确认入库
        </button>
      </div>

      {blocked.length > 0 && (
        <div className="blocked-list">
          {blocked.map((r) => (
            <p key={r.id} className="hint">
              {r.id}（{r.batchNo}）：{accessionBlockReason(r, state.repairs, state.accessions)}
            </p>
          ))}
        </div>
      )}

      {stored.length > 0 && <h3 className="sub-heading">已入库（更正另建版本，旧值可查）</h3>}
      <div className="record-list">
        {stored.map((r) => {
          const accession = findAccession(state.accessions, r.id)!;
          const current = currentVersion(accession);
          const isExpanded = expanded === r.id;
          return (
            <article key={r.id} className="record-card">
              <div className="record-index">{r.id.slice(-2)}</div>
              <div>
                <h3>
                  {r.batchNo} · {r.trench} · {r.layer} <StatusBadge status="stored" />
                </h3>
                <p>
                  现值：{current.count} 件 · {current.location}（v{current.version}，{current.at}）
                </p>
                <div className="row-actions">
                  <button onClick={() => setExpanded(isExpanded ? null : r.id)}>
                    {isExpanded ? "收起版本" : `版本记录（${accession.versions.length}）`}
                  </button>
                  <button
                    onClick={() => {
                      setCorrectId(correctId === r.id ? "" : r.id);
                      setCorrectCount(current.count);
                      setCorrectLocation(current.location);
                      setReason("");
                    }}
                  >
                    更正
                  </button>
                </div>
                {isExpanded && (
                  <table className="version-table">
                    <thead>
                      <tr>
                        <th>版本</th>
                        <th>件数</th>
                        <th>库位</th>
                        <th>原因</th>
                        <th>经办</th>
                        <th>时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...accession.versions].reverse().map((v) => (
                        <tr key={v.version}>
                          <td>v{v.version}</td>
                          <td>{v.count}</td>
                          <td>{v.location}</td>
                          <td>{v.reason}</td>
                          <td>{v.operator}</td>
                          <td>{v.at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {correctId === r.id && (
                  <div className="correct-form">
                    <input
                      type="number"
                      min={1}
                      value={correctCount}
                      onChange={(e) => setCorrectCount(Math.max(1, Number(e.target.value) || 1))}
                      placeholder="更正后件数"
                    />
                    <select value={correctLocation} onChange={(e) => setCorrectLocation(e.target.value)}>
                      {storageLocations.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <input
                      value={reason}
                      placeholder="更正原因（必填）"
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <button
                      className="primary-action"
                      disabled={!reason.trim()}
                      onClick={() => {
                        onCorrect(r.id, correctCount, correctLocation, reason.trim(), operator);
                        setCorrectId("");
                      }}
                    >
                      存为新版本
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function App() {
  const [state, setState] = useState<WorkbenchState>(loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const metrics = useMemo(() => summarize(state), [state]);
  const holdRecords = state.intakes.filter((r) => r.holdReasons.length > 0);

  const register = (input: IntakeInput) => {
    const holdReasons = checkIntakeAgainstSlips(input, transferSlips);
    const record: IntakeRecord = {
      id: nextId("RK", state.intakes.map((r) => r.id)),
      batchNo: input.batchNo.trim(),
      trench: input.trench.trim(),
      layer: input.layer.trim(),
      coordinates: input.coordinates.trim(),
      count: input.count,
      condition: input.condition,
      receiver: input.receiver,
      receivedAt: now(),
      holdReasons,
    };
    setState((s) => ({ ...s, intakes: [record, ...s.intakes] }));
  };

  const resolveHold = (id: string) =>
    setState((s) => ({
      ...s,
      intakes: s.intakes.map((r) => (r.id === id ? { ...r, holdReasons: [] } : r)),
    }));

  const returnToSender = (id: string) =>
    setState((s) => ({
      ...s,
      intakes: s.intakes.filter((r) => r.id !== id),
      repairs: s.repairs.filter((o) => o.intakeId !== id),
    }));

  const createRepair = (intakeId: string, missingPart: string, handler: string) =>
    setState((s) => ({
      ...s,
      repairs: [
        ...s.repairs,
        {
          id: nextId("XF", s.repairs.map((o) => o.id)),
          intakeId,
          missingPart,
          handler,
          createdAt: now(),
          state: "repairing",
        },
      ],
    }));

  const recheckRepair = (orderId: string) =>
    setState((s) => ({
      ...s,
      repairs: s.repairs.map((o) => (o.id === orderId ? { ...o, state: "rechecked" as const } : o)),
    }));

  const store = (intakeId: string, count: number, location: string, operator: string) =>
    setState((s) => ({
      ...s,
      accessions: [
        ...s.accessions,
        {
          intakeId,
          versions: [{ version: 1, count, location, reason: "首次入库", operator, at: now() }],
        },
      ],
    }));

  const correct = (intakeId: string, count: number, location: string, reason: string, operator: string) =>
    setState((s) => ({
      ...s,
      accessions: s.accessions.map((a) =>
        a.intakeId === intakeId
          ? { ...a, versions: [...a.versions, nextVersion(a.versions, { count, location, reason, operator }, now())] }
          : a
      ),
    }));

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">
            {project.id} · port {project.port}
          </p>
          <h1>{project.title}</h1>
          <p className="subtitle">{project.subtitle}</p>
        </div>
        <div className="stack-card">
          <span>移交单底账</span>
          {transferSlips.map((s) => (
            <strong key={s.batchNo}>
              {s.batchNo} · {s.trench} · {s.layer} · {s.coordinates} · {s.count}件
            </strong>
          ))}
          <button onClick={() => setState(resetState())}>重置为初始台帐</button>
        </div>
      </section>

      <section className="metrics-grid">
        {Object.entries(metrics).map(([label, value], index) => (
          <MetricCard key={label} label={label} value={value} index={index} />
        ))}
      </section>

      <div className="workspace">
        <IntakeForm onRegister={register} />
        <HoldSection records={holdRecords} onResolve={resolveHold} onReturn={returnToSender} />
      </div>

      <div className="workspace">
        <RepairSection state={state} onCreate={createRepair} onRecheck={recheckRepair} />
        <AccessionSection state={state} onStore={store} onCorrect={correct} />
      </div>
    </main>
  );
}

export default App;
