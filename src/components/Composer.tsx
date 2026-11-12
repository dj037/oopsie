import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import { useStore } from "../lib/store";
import { generateDraft } from "../../shared/planner";
import {
  blankTrip,
  calculatePlan,
  newItem,
  scenes,
  sceneLabel,
  transportLabels,
  type Trip,
} from "../../shared/domain";
import {
  Button,
  Icon,
  IconButton,
  Modal,
  Badge,
  toInputDate,
  timeText,
  Toggle,
  type IconName,
} from "./ui";
import {
  requestNotifications,
  isNative,
  enableAudio,
} from "../lib/notifications";

export function Composer({
  initial,
  initialText = "",
  onClose,
  onSaved,
  notify,
}: {
  initial?: Trip;
  initialText?: string;
  onClose: () => void;
  onSaved: (id: string) => void;
  notify: (m: string) => void;
}) {
  const { data, saveTrip, aiEnabled } = useStore();
  const [step, setStep] = useState<"input" | "preview">(
      initial ? "preview" : "input",
    ),
    [text, setText] = useState(initialText),
    [draft, setDraft] = useState<Trip>(initial || blankTrip(data.preferences));
  const [notices, setNotices] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [wantReminders, setReminders] = useState(initial?.remindersEnabled ?? true),
    [newName, setNewName] = useState("");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  function close() {
    if (busy) {
      abort.current?.abort();
      setBusy(false);
      return;
    }
    onClose();
  }
  async function generate() {
    if (!text.trim()) {
      setError("先告诉我，你准备出门做什么？");
      return;
    }
    setBusy(true);
    setError("");
    abort.current = new AbortController();
    const timer = setTimeout(() => abort.current?.abort("timeout"), 18_000);
    try {
      let result;
      try {
        result = await api.draft(text, abort.current.signal);
      } catch (e) {
        if (
          abort.current.signal.aborted &&
          abort.current.signal.reason !== "timeout"
        )
          return;
        if (e instanceof ApiError && [401, 429].includes(e.status)) throw e;
        result = generateDraft(text, data.preferences);
        result.notices.unshift(
          "已使用本机场景模板生成，联网后可继续使用智能服务。",
        );
      }
      result.trip.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setDraft(result.trip);
      setNotices(result.notices);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败，请尝试手动创建");
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }
  function patch(change: Partial<Trip>) {
    setDraft((d) => ({ ...d, ...change }));
  }
  const plan = calculatePlan(draft);
  async function save() {
    setError("");
    if (!draft.title.trim()) {
      setError("请填写行程名称");
      return;
    }
    if (draft.items.some((i) => !i.name.trim())) {
      setError("物品名称不能为空");
      return;
    }
    if (
      wantReminders &&
      !plan &&
      (!draft.checklistReminderAt ||
        Date.parse(draft.checklistReminderAt) <= Date.now())
    ) {
      setError(
        "还没有完整的出发时间，请设置未来的单次检查时间，或关闭提醒后保存清单。",
      );
      return;
    }
    const enabled = data.trips.filter(
      (t) =>
        t.id !== draft.id &&
        t.status === "planned" &&
        t.remindersEnabled &&
        (calculatePlan(t)?.departure ??
          Date.parse(t.checklistReminderAt || "")) +
          900_000 >
          Date.now(),
    );
    if (wantReminders && enabled.length >= 5) {
      setError("最多同时开启 5 个行程的提醒，请先暂停其他行程。");
      return;
    }
    if (!initial && data.trips.length >= 300) {
      setError("最多保留 300 条行程，请清理历史行程后重试。");
      return;
    }
    setBusy(true);
    try {
      let status;
      if (wantReminders) {
        enableAudio();
        status = await requestNotifications();
      }
      const nativeReady = status === "native-ready";
      const remindersEnabled = wantReminders && (isNative ? nativeReady : true);
      const next: Trip = {
        ...draft,
        items: draft.items.map((i) => {
          const old = initial?.items.find((x) => x.id === i.id);
          return old && (old.name !== i.name || old.quantity !== i.quantity)
            ? {
                ...i,
                state: "pending",
                confirmedAt: null,
                verification: null,
                waivedReason: "",
              }
            : i;
        }),
        title: draft.title.trim(),
        checklistReminderAt: plan ? null : draft.checklistReminderAt,
        remindersEnabled,
        revision: initial ? initial.revision + 1 : 1,
        updatedAt: new Date().toISOString(),
        snoozeCount: 0,
        snoozeUntil: null,
        snoozedAt: null,
      };
      saveTrip(next);
      onSaved(next.id);
      notify(
        wantReminders
          ? isNative
            ? nativeReady
              ? "计划已保存，正在安排系统提醒"
              : "计划已保存，系统通知未开启"
            : "计划已保存，页面保持打开时会提醒"
          : "清单已保存",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      setBusy(false);
    }
  }
  const overlaps =
    plan &&
    data.trips.some(
      (t) =>
        t.id !== draft.id &&
        t.status === "planned" &&
        calculatePlan(t) &&
        Math.abs(calculatePlan(t)!.departure - plan.departure) < 30 * 60_000,
    );
  return (
    <Modal
      title={
        step === "input" ? "添加行程" : initial ? "编辑行程" : "确认行程计划"
      }
      subtitle={
        step === "input"
          ? "Create a new trip"
          : initial
            ? "Edit your trip"
            : "Review your preparation plan"
      }
      eyebrow={
        step === "input"
          ? "新建行程 · 下一站，去做什么？"
          : "确认你的物品和出发计划"
      }
      onClose={close}
      wide={step === "preview"}
      footer={
        step === "input" ? (
          <>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setDraft(blankTrip(data.preferences));
                setNotices([]);
                setStep("preview");
              }}
            >
              手动创建
            </Button>
            <Button
              onClick={generate}
              disabled={busy}
              icon={busy ? "loader" : "sparkles"}
            >
              {busy ? "正在整理你的安排…" : "生成准备计划"}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              onClick={() => (initial ? onClose() : setStep("input"))}
              disabled={busy}
            >
              {initial ? "取消" : "返回描述"}
            </Button>
            <Button
              icon={busy ? "loader" : "check"}
              disabled={busy}
              onClick={save}
            >
              {busy
                ? "正在保存…"
                : wantReminders
                  ? "保存并开启提醒"
                  : "保存清单"}
            </Button>
          </>
        )
      }
    >
      {step === "input" ? (
        <div className="scene-input">
          <p className="muted">
            时间、地点、要做的事，想到什么就告诉我。
            <br />
            物品和准备步骤，我来帮你整理。
          </p>
          <div className="prompt-area">
            <Icon name="sparkles" size={22} />
            <textarea
              autoFocus
              aria-label="外出场景描述"
              maxLength={2000}
              rows={5}
              placeholder="比如：明天上午 9 点去公司做汇报，地铁通勤 40 分钟，需要用自己的电脑……"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <span className="char-count">{text.length} / 2000</span>
          </div>
          <h4>也可以从这些场景开始</h4>
          <div className="scene-grid">
            {scenes.map((s) => (
              <button key={s.id} onClick={() => setText(s.prompt)}>
                <Icon name={s.icon as IconName} />
                <span>{s.label}</span>
              </button>
            ))}
          </div>
          <div className="soft-note">
            <Icon name="shield" size={17} />
            <span>
              {aiEnabled
                ? "点击生成后，这段描述将发送给已配置的智能服务，用于生成本次物品建议。"
                : "根据场景模板和你填写的信息推荐。保存前，你可以确认和调整所有建议。"}
            </span>
          </div>
        </div>
      ) : (
        <div className="plan-editor">
          <div className="plan-summary">
            <span className="scene-symbol">
              <Icon
                name={
                  (scenes.find((s) => s.id === draft.scene)?.icon ||
                    "backpack") as IconName
                }
                size={24}
              />
            </span>
            <div>
              <strong>{sceneLabel(draft.scene)}</strong>
              <p>建议已整理好，再确认一下就能出发。</p>
            </div>
            <Badge tone={draft.generation === "manual" ? "neutral" : "orange"}>
              {draft.generation === "ai"
                ? "智能建议"
                : draft.generation === "rules"
                  ? "场景推荐"
                  : "手动创建"}
            </Badge>
          </div>
          {notices.length > 0 && (
            <details className="notices">
              <summary>
                <Icon name="info" size={16} /> 有 {notices.length}{" "}
                条信息需要你留意 <Icon name="down" size={14} />
              </summary>
              <ul>
                {notices.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </details>
          )}
          <section className="editor-section">
            <div className="section-heading">
              <h3>
                <span>01</span> 行程信息
              </h3>
            </div>
            <div className="form-grid">
              <label className="field span-2">
                行程名称
                <input
                  value={draft.title}
                  maxLength={80}
                  placeholder="例如：周一方案汇报"
                  onChange={(e) => patch({ title: e.target.value })}
                />
              </label>
              <label className="field">
                出发地
                <input
                  value={draft.origin}
                  maxLength={200}
                  placeholder="家 / 公司 / 详细地址"
                  onChange={(e) => patch({ origin: e.target.value })}
                />
              </label>
              <label className="field">
                目的地
                <input
                  value={draft.destination}
                  maxLength={200}
                  placeholder="填写完整地址，方便导航"
                  onChange={(e) => patch({ destination: e.target.value })}
                />
              </label>
              <label className="field">
                规划方式
                <select
                  value={draft.mode}
                  onChange={(e) =>
                    patch({ mode: e.target.value as Trip["mode"] })
                  }
                >
                  <option value="arrival">按活动开始时间倒推</option>
                  <option value="departure">我已经确定出发时间</option>
                </select>
              </label>
              <label className="field">
                {draft.mode === "arrival" ? "活动开始时间" : "指定出发时间"}
                <input
                  type="datetime-local"
                  value={toInputDate(draft.scheduledAt)}
                  onChange={(e) =>
                    patch({
                      scheduledAt: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    })
                  }
                />
              </label>
              <label className="field">
                交通方式
                <select
                  value={draft.transport}
                  onChange={(e) =>
                    patch({ transport: e.target.value as Trip["transport"] })
                  }
                >
                  {Object.entries(transportLabels).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                预计通勤用时（分钟）
                <input
                  type="number"
                  min={0}
                  max={2880}
                  inputMode="numeric"
                  placeholder="由你估计，例如 40"
                  value={draft.travelMinutes ?? ""}
                  onChange={(e) =>
                    patch({
                      travelMinutes:
                        e.target.value === ""
                          ? null
                          : Math.min(
                              2880,
                              Math.max(0, Math.round(Number(e.target.value))),
                            ),
                    })
                  }
                />
              </label>
            </div>
            <div className="time-options">
              {(
                [
                  ["prepareMinutes", "准备时长", 1440],
                  ["bufferMinutes", "交通缓冲", 240],
                  ["leadMinutes", "提前到达", 240],
                ] as const
              )
                .filter(
                  ([key]) =>
                    draft.mode === "arrival" || key === "prepareMinutes",
                )
                .map(([key, label, max]) => (
                  <label className="field" key={key}>
                    {label}
                    <div className="unit-input">
                      <input
                        aria-label={label}
                        type="number"
                        min={0}
                        max={max}
                        value={draft[key]}
                        onChange={(e) =>
                          patch({
                            [key]: Math.min(
                              max,
                              Math.max(0, Math.round(Number(e.target.value))),
                            ),
                          })
                        }
                      />
                      <span>分钟</span>
                    </div>
                  </label>
                ))}
            </div>
            {plan ? (
              <div className="time-preview">
                <div>
                  <span>开始准备</span>
                  <strong>{timeText(plan.prepare)}</strong>
                </div>
                <Icon name="arrow" size={16} />
                <div className="highlight">
                  <span>建议出发</span>
                  <strong>{timeText(plan.departure)}</strong>
                </div>
                <Icon name="arrow" size={16} />
                <div>
                  <span>预计到达</span>
                  <strong>{timeText(plan.arrival)}</strong>
                </div>
              </div>
            ) : (
              <div className="inline-info">
                <Icon name="info" size={16} /> 补充时间
                {draft.mode === "arrival" ? "和通勤用时" : ""}
                后，将为你计算出发时间。
              </div>
            )}
            {plan && plan.departure < Date.now() && (
              <div className="inline-warning">
                <Icon name="alert" size={16} />{" "}
                已超过建议出发时间。可以修改时间，或保存后马上检查。
              </div>
            )}
            {overlaps && (
              <div className="inline-warning">
                <Icon name="calendar" size={16} /> 另一条行程的出发时间在前后 30
                分钟内，请确认能否衔接。
              </div>
            )}
          </section>
          <section className="editor-section">
            <div className="section-heading">
              <h3>
                <span>02</span> 物品清单
              </h3>
              <small>{draft.items.length} 件 · 保存后逐项确认携带</small>
            </div>
            <div className="editor-items">
              {draft.items.map((item, index) => (
                <div className="editor-item" key={item.id}>
                  <span className="item-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="editor-item-name">
                    <input
                      aria-label={`物品名称 ${index + 1}`}
                      value={item.name}
                      maxLength={80}
                      onChange={(e) =>
                        patch({
                          items: draft.items.map((i) =>
                            i.id === item.id
                              ? {
                                  ...i,
                                  name: e.target.value,
                                  state: "pending",
                                  confirmedAt: null,
                                }
                              : i,
                          ),
                        })
                      }
                    />
                    <p>{item.reason}</p>
                  </div>
                  <input
                    className="quantity-input"
                    type="number"
                    min={1}
                    max={99}
                    aria-label={`${item.name}数量`}
                    value={item.quantity}
                    onChange={(e) =>
                      patch({
                        items: draft.items.map((i) =>
                          i.id === item.id
                            ? {
                                ...i,
                                quantity: Math.min(
                                  99,
                                  Math.max(
                                    1,
                                    Math.round(Number(e.target.value)),
                                  ),
                                ),
                                state: "pending",
                                confirmedAt: null,
                              }
                            : i,
                        ),
                      })
                    }
                  />
                  <button
                    className={`required-switch ${item.required ? "required" : ""}`}
                    onClick={() =>
                      patch({
                        items: draft.items.map((i) =>
                          i.id === item.id
                            ? { ...i, required: !i.required }
                            : i,
                        ),
                      })
                    }
                  >
                    {item.required ? "必带" : "建议"}
                  </button>
                  <IconButton
                    name="x"
                    label={`移除${item.name}`}
                    onClick={() =>
                      patch({
                        items: draft.items.filter((i) => i.id !== item.id),
                      })
                    }
                  />
                </div>
              ))}
            </div>
            <div className="add-item">
              <Icon name="plus" size={18} />
              <input
                aria-label="新增物品名称"
                placeholder="还有什么要带？添加一件物品"
                maxLength={80}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    newName.trim() &&
                    draft.items.length < 100
                  ) {
                    e.preventDefault();
                    patch({ items: [...draft.items, newItem(newName.trim())] });
                    setNewName("");
                  }
                }}
              />
              <button
                disabled={!newName.trim() || draft.items.length >= 100}
                onClick={() => {
                  patch({ items: [...draft.items, newItem(newName.trim())] });
                  setNewName("");
                }}
              >
                添加
              </button>
            </div>
          </section>
          <section className="editor-section">
            <div className="section-heading">
              <h3>
                <span>03</span> 出发提醒
              </h3>
            </div>
            <Toggle
              checked={wantReminders}
              onChange={setReminders}
              label="开启本次出发提醒"
              description={
                isNative
                  ? "准备开始、出发前与出发时提醒你。"
                  : "页面内提醒可直接使用；网页版需保持页面打开。"
              }
            />
            {wantReminders && !plan && (
              <label className="field checklist-reminder-field">
                单次检查时间
                <input
                  type="datetime-local"
                  value={toInputDate(draft.checklistReminderAt)}
                  onChange={(e) =>
                    patch({
                      checklistReminderAt: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    })
                  }
                />
                <span className="fine-print">
                  还没定出发时间也没关系。在这里指定一次检查提醒，不会生成出发倒计时。
                </span>
              </label>
            )}
            <p className="fine-print">
              提醒会在确认出发或取消行程后停止。静音与专注模式仍受系统设置影响。
            </p>
          </section>
        </div>
      )}
      {error && (
        <div className="error-box" role="alert">
          <Icon name="alert" size={18} />
          {error}
        </div>
      )}
    </Modal>
  );
}
