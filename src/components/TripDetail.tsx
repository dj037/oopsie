import { useState } from "react";
import { useStore } from "../lib/store";
import { COMPLETION_POINTS } from "../../shared/rewards";
import {
  calculatePlan,
  departureCheck,
  duplicateTrip,
  itemStats,
  mapUrl,
  timeline,
  transportLabels,
  sceneLabel,
  newId,
  newItem,
  snoozeTrip,
  type Trip,
  type Item,
} from "../../shared/domain";
import {
  Button,
  Icon,
  IconButton,
  Modal,
  Badge,
  Confirm,
  timeText,
  dateText,
  Toggle,
} from "./ui";
import { isNative, requestNotifications } from "../lib/notifications";

export function ItemRow({
  item,
  onToggle,
  onWaive,
  disabled = false,
}: {
  item: Item;
  onToggle: () => void;
  onWaive: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={`check-item ${item.state}`}>
      <button
        className="item-check"
        aria-label={`${item.state === "confirmed" ? "撤销确认" : "扫描确认"}${item.name}`}
        aria-pressed={item.state === "confirmed"}
        onClick={onToggle}
        disabled={disabled}
      >
        {item.state === "confirmed" ? (
          <Icon name="check" size={17} />
        ) : item.state === "waived" ? (
          <Icon name="minus" size={17} />
        ) : null}
      </button>
      <div className="check-item-copy">
        <strong>
          {item.name}
          {item.quantity > 1 && <small> ×{item.quantity}</small>}
        </strong>
        <p>
          {item.state === "waived"
            ? "这次不带 · 可点击重新加入"
            : item.state === "confirmed"
              ? item.verification
                ? "已通过拍摄识别"
                : "历史手动确认记录"
              : item.reason}
        </p>
      </div>
      {item.required && <span className="required-label">必带</span>}
      {!disabled && (
        <button className="waive-button" onClick={onWaive}>
          {item.state === "waived" ? "恢复" : "不带"}
        </button>
      )}
    </div>
  );
}
export function TripDetail({
  id,
  onClose,
  onEdit,
  notify,
  onScan,
  onStart,
  preparationReview = false,
}: {
  id: string;
  onClose: () => void;
  onEdit: (trip: Trip) => void;
  notify: (m: string) => void;
  onScan: (tripId: string, itemId: string) => void;
  onStart: () => void;
  preparationReview?: boolean;
}) {
  const { data, saveTrip, removeTrip, completeTrip } = useStore();
  const trip = data.trips.find((t) => t.id === id);
  const [confirm, setConfirm] = useState<
      null | "depart" | "cancel" | "delete" | "undo" | "waive"
    >(null),
    [waiveId, setWaiveId] = useState(""),
    [reason, setReason] = useState(""),
    [feedback, setFeedback] = useState(false),
    [missing, setMissing] = useState<boolean | null>(null),
    [note, setNote] = useState(""),
    [suggested, setSuggested] = useState(true);
  const [extraName, setExtraName] = useState(""),
    [extraRequired, setExtraRequired] = useState(true),
    [finishing, setFinishing] = useState(false);
  if (!trip)
    return (
      <Modal title="未找到这条行程" onClose={onClose}>
        <p className="muted">行程可能已被删除。你可以返回创建新的计划。</p>
      </Modal>
    );
  const stats = itemStats(trip),
    plan = calculatePlan(trip),
    isPlanned = trip.status === "planned";
  function update(change: Partial<Trip>) {
    saveTrip({ ...trip!, ...change, updatedAt: new Date().toISOString() });
  }
  function addExtra() {
    const name = extraName.trim();
    if (!name) return;
    if (trip!.items.length >= 100) {
      notify("每个行程最多 100 件物品");
      return;
    }
    if (
      trip!.items.some(
        (i) => i.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    ) {
      notify("这件物品已经在清单中");
      return;
    }
    update({ items: [...trip!.items, newItem(name, extraRequired)] });
    setExtraName("");
    notify("已添加物品并自动保存");
  }
  async function finish(skip = false) {
    setFinishing(true);
    try {
      const points = await completeTrip(
        id,
        skip ? null : missing,
        skip ? "" : note,
      );
      setFeedback(false);
      notify(
        points
          ? `行程已完成，获得 ${points} 积分`
          : "行程已完成，本次没有重复计分",
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setFinishing(false);
    }
  }
  function itemState(item: Item, state: Item["state"]) {
    update({
      items: trip!.items.map((i) =>
        i.id === item.id
          ? {
              ...i,
              state,
              confirmedAt:
                state === "confirmed" ? new Date().toISOString() : null,
              waivedReason: state === "waived" ? reason : "",
              verification: null,
            }
          : i,
      ),
    });
  }
  function depart(override = false) {
    try {
      saveTrip(departureCheck(trip!, override));
      setConfirm(null);
      notify("已确认出发，本次提醒已停止。一路顺利！");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  function toggle(item: Item) {
    if (item.state === "confirmed" || item.state === "waived")
      itemState(item, "pending");
    else onScan(id, item.id);
  }
  function waive(item: Item) {
    if (item.state === "waived") {
      itemState(item, "pending");
      return;
    }
    setWaiveId(item.id);
    setReason("");
    setConfirm("waive");
  }
  async function toggleReminders(enabled: boolean) {
    if (enabled) {
      if (
        !plan &&
        (!trip?.checklistReminderAt ||
          Date.parse(trip.checklistReminderAt) <= Date.now())
      ) {
        notify("请先编辑行程，补充出发时间或设置单次检查时间");
        return;
      }
      const active = data.trips.filter(
        (t) =>
          t.id !== id &&
          t.status === "planned" &&
          t.remindersEnabled &&
          (calculatePlan(t)?.departure ??
            Date.parse(t.checklistReminderAt || "")) +
            900_000 >
            Date.now(),
      );
      if (active.length >= 5) {
        notify("最多开启 5 个行程的提醒");
        return;
      }
      const permission = await requestNotifications();
      if (isNative && permission !== "native-ready") {
        notify("系统通知尚未授权，请在系统设置中开启");
        return;
      }
    }
    update({ remindersEnabled: enabled });
    notify(
      enabled
        ? isNative
          ? "正在安排系统提醒"
          : "已开启页面内提醒"
        : "已暂停本次提醒",
    );
  }
  if (confirm) {
    const types = {
      depart: {
        title: "还有物品未确认",
        description: (
          <>
            <p>这 {stats.pending.length} 件物品还没确认：</p>
            <div className="missing-chips">
              {stats.pending.map((i) => (
                <Badge tone="orange" key={i.id}>
                  {i.name}
                </Badge>
              ))}
            </div>
            <p>
              你可以返回检查，或明确选择仍然出发。我们会保留这次未确认的记录。
            </p>
          </>
        ),
        label: "仍然出发",
        action: () => depart(true),
      },
      cancel: {
        title: "取消这次行程？",
        description: "取消后，本次所有提醒都会停止。行程会保留在历史记录中。",
        label: "取消行程",
        action: () => {
          update({
            status: "cancelled",
            remindersEnabled: false,
            snoozeUntil: null,
          });
          setConfirm(null);
          notify("行程已取消");
        },
      },
      delete: {
        title: "删除这条行程？",
        description:
          "行程和物品记录将从当前账号移除，同时停止本次提醒。此操作无法撤销。",
        label: "删除行程",
        action: () => {
          removeTrip(id);
          onClose();
          notify("行程已删除");
        },
      },
      undo: {
        title: "撤销出发确认？",
        description:
          "行程将回到待出发，物品确认结果保留。你可以按需要重新开启提醒。",
        label: "撤销出发",
        action: () => {
          update({
            status: "planned",
            departedAt: null,
            missingAtDeparture: [],
            waivedAtDeparture: [],
            revision: trip.revision + 1,
            snoozeCount: 0,
            snoozeUntil: null,
            snoozedAt: null,
          });
          setConfirm(null);
        },
      },
      waive: {
        title: `这次不带「${trip.items.find((i) => i.id === waiveId)?.name}」？`,
        description: (
          <>
            <p>这会记为“这次不带”，不会标记为已携带。</p>
            <label className="field">
              备注（可选）
              <input
                placeholder="例如：现场有备用的"
                maxLength={200}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          </>
        ),
        label: "确认这次不带",
        action: () => {
          const i = trip.items.find((i) => i.id === waiveId);
          if (i) itemState(i, "waived");
          setConfirm(null);
        },
      },
    };
    const c = types[confirm];
    return (
      <Confirm
        title={c.title}
        description={c.description}
        confirmText={c.label}
        onConfirm={c.action}
        onClose={() => setConfirm(null)}
        danger={confirm === "delete" || confirm === "cancel"}
      />
    );
  }
  if (feedback)
    return (
      <Modal
        title="这次出发，还顺利吗？"
        subtitle="A little reflection"
        onClose={() => !finishing && setFeedback(false)}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={finishing}
              onClick={() => void finish(true)}
            >
              跳过反馈，结束行程
            </Button>
            <Button disabled={finishing} onClick={() => void finish()}>
              完成行程 · 领取 {COMPLETION_POINTS} 积分
            </Button>
          </>
        }
      >
        <div className="reflection">
          <img src="/assets/mascot.png" alt="" />
          <p>有没有忘带什么？一点记录，让下次更从容。</p>
          <div className="segmented">
            <button
              className={missing === false ? "active" : ""}
              onClick={() => setMissing(false)}
            >
              都带好了
            </button>
            <button
              className={missing === true ? "active" : ""}
              onClick={() => setMissing(true)}
            >
              有遗漏
            </button>
          </div>
          {missing && (
            <label className="field">
              忘带了什么？
              <textarea
                rows={3}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="记下来，下次再提醒自己"
              />
            </label>
          )}
        </div>
      </Modal>
    );
  return (
    <Modal
      title={trip.title}
      subtitle="Trip checklist & preparation"
      eyebrow={sceneLabel(trip.scene) + " / " + dateText(trip.scheduledAt)}
      onClose={onClose}
      wide
      footer={
        isPlanned && preparationReview ? (
          <div className="start-preparation-footer">
            <small>
              {data.activeTripId && data.activeTripId !== trip.id
                ? "将切换当前准备的行程，其他行程仍保留。"
                : "核对清单后，进入时钟开始准备。"}
            </small>
            <Button icon="alarm" onClick={onStart}>
              {data.activeTripId === trip.id
                ? "继续准备这条行程"
                : "确认开始准备行程"}
            </Button>
          </div>
        ) : isPlanned ? (
          <>
            <div className="footer-progress">
              <strong>{stats.confirmed}</strong>/{stats.total} 件必带已确认
              {stats.waived > 0 && <small> · {stats.waived} 件这次不带</small>}
            </div>
            <Button
              icon="navigation"
              onClick={() =>
                stats.pending.length ? setConfirm("depart") : depart()
              }
            >
              {stats.pending.length ? "检查后出发" : "确认出发"}
            </Button>
          </>
        ) : trip.status === "departed" ? (
          <>
            <Button
              variant="secondary"
              icon="undo"
              onClick={() => setConfirm("undo")}
            >
              撤销出发
            </Button>
            <Button icon="check" onClick={() => setFeedback(true)}>
              结束行程
            </Button>
          </>
        ) : (
          <>
            <Badge tone={trip.status === "completed" ? "green" : "neutral"}>
              {trip.status === "completed" ? "行程已结束" : "行程已取消"}
            </Badge>
            <Button icon="copy" onClick={() => onEdit(duplicateTrip(trip))}>
              再来一次
            </Button>
          </>
        )
      }
    >
      <div className="detail-top">
        <div className="detail-where">
          <span className="scene-symbol">
            <Icon name="pin" size={23} />
          </span>
          <div>
            <h3>{trip.destination || "目的地待补充"}</h3>
            <p>
              {trip.origin ? `从 ${trip.origin} 出发 · ` : ""}
              {transportLabels[trip.transport]}
              {trip.travelMinutes !== null
                ? ` · ${trip.travelMinutes} 分钟`
                : ""}
            </p>
          </div>
        </div>
        <div className="detail-actions">
          {isPlanned && (
            <IconButton
              name="edit"
              label="编辑行程"
              onClick={() => onEdit(trip)}
            />
          )}
          <IconButton
            name="copy"
            label="复制行程"
            onClick={() => onEdit(duplicateTrip(trip))}
          />
          <IconButton
            name="trash"
            label="删除行程"
            onClick={() => setConfirm("delete")}
          />
        </div>
      </div>
      {plan && (
        <div className="time-preview detail-time">
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
      )}
      {!plan && trip.checklistReminderAt && (
        <div className="inline-info">
          <Icon name="bell" size={17} /> 单次检查：
          {dateText(trip.checklistReminderAt)}{" "}
          {timeText(trip.checklistReminderAt)} · 物品全部处理后停止提醒
        </div>
      )}
      {trip.status === "departed" && (
        <div className="departed-banner">
          <Icon name="navigation" />
          <div>
            <strong>出发啦，一路顺利！</strong>
            <p>{timeText(trip.departedAt)} 手动确认出发 · 所有本次提醒已停止</p>
          </div>
        </div>
      )}
      {trip.missingAtDeparture.length > 0 && (
        <div className="inline-warning">
          <Icon name="alert" size={17} /> 出发时仍未确认：
          {trip.missingAtDeparture.join("、")}
        </div>
      )}
      <div className="detail-columns">
        <section>
          <div className="section-heading">
            <h3>
              必带物品 <span className="count-pill">{stats.total}</span>
            </h3>
            <Badge tone={stats.pending.length ? "orange" : "green"}>
              {stats.total === 0
                ? "未设置必带"
                : stats.pending.length
                  ? `${stats.pending.length} 件待确认`
                  : stats.waived
                    ? "已处理，含不带项"
                    : "全部已确认"}
            </Badge>
          </div>
          <div className="checklist">
            {trip.items
              .filter((i) => i.required)
              .map((i) => (
                <ItemRow
                  key={i.id}
                  item={i}
                  onToggle={() => toggle(i)}
                  onWaive={() => waive(i)}
                  disabled={!isPlanned}
                />
              ))}
            {!stats.total && (
              <p className="muted small-copy">
                你还没有设置必带项，可以编辑清单添加。
              </p>
            )}
          </div>
          {trip.items.some((i) => !i.required) && (
            <>
              <button
                className="suggested-heading"
                onClick={() => setSuggested(!suggested)}
              >
                <span>
                  按需携带 · {trip.items.filter((i) => !i.required).length} 件
                </span>
                <Icon name={suggested ? "down" : "chevron"} size={17} />
              </button>
              {suggested &&
                trip.items
                  .filter((i) => !i.required)
                  .map((i) => (
                    <ItemRow
                      key={i.id}
                      item={i}
                      onToggle={() => toggle(i)}
                      onWaive={() => waive(i)}
                      disabled={!isPlanned}
                    />
                  ))}
            </>
          )}
          {isPlanned && (
            <form
              className="detail-add-item"
              onSubmit={(e) => {
                e.preventDefault();
                addExtra();
              }}
            >
              <h3>
                补充要带的物品
                <small className="title-english">Add to this checklist</small>
              </h3>
              <div className="add-item">
                <input
                  aria-label="补充物品名称"
                  maxLength={80}
                  placeholder="例如：耳机、雨伞、钥匙"
                  value={extraName}
                  onChange={(e) => setExtraName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.nativeEvent.isComposing)
                      e.preventDefault();
                  }}
                />
                <button
                  type="submit"
                  disabled={!extraName.trim() || trip.items.length >= 100}
                >
                  添加
                </button>
              </div>
              <label className="required-option">
                <input
                  type="checkbox"
                  checked={extraRequired}
                  onChange={(e) => setExtraRequired(e.target.checked)}
                />
                设为本次必带物品
              </label>
              <p className="fine-print">
                立即保存到本次行程；新增物品需要重新扫描确认。
              </p>
            </form>
          )}
          <div className="soft-note">
            <Icon name="info" size={16} />
            <span>
              待确认物品需拍摄识别通过后才能划掉。识别通过后，请把它放进包里；“这次不带”会单独记录。
            </span>
          </div>
        </section>
        <section className="timeline-panel">
          <div className="section-heading">
            <h3>准备时间轴</h3>
            <Icon name="clock" size={18} />
          </div>
          {plan ? (
            <div className="timeline">
              {timeline(trip).map((s) => (
                <div
                  className={`timeline-row ${trip.stepsDone.includes(s.id) ? "done" : ""}`}
                  key={s.id}
                >
                  <button
                    className="timeline-dot"
                    disabled={
                      !isPlanned || s.id === "depart" || s.id === "arrive"
                    }
                    aria-label={`切换步骤：${s.title}`}
                    onClick={() =>
                      update({
                        stepsDone: trip.stepsDone.includes(s.id)
                          ? trip.stepsDone.filter((x) => x !== s.id)
                          : [...trip.stepsDone, s.id],
                      })
                    }
                  >
                    {trip.stepsDone.includes(s.id) ? (
                      <Icon name="check" size={11} />
                    ) : null}
                  </button>
                  <div>
                    <time>{timeText(s.at)}</time>
                    <strong>{s.title}</strong>
                    <p>{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-mini">
              <Icon name="clock" />
              <p>
                补充时间与通勤用时后，
                <br />
                就能看到你的准备时间轴。
              </p>
            </div>
          )}
          {trip.destination && (
            <a
              className="map-link"
              href={mapUrl(trip)}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="navigation" size={18} /> 打开地图导航{" "}
              <Icon name="external" size={15} />
            </a>
          )}
          <p className="fine-print">
            预计通勤用时由你填写，未接入实时路况。打开地图不会自动确认出发。
          </p>
        </section>
      </div>
      {isPlanned && (
        <section className="detail-reminders">
          <Toggle
            checked={trip.remindersEnabled}
            onChange={(v) => void toggleReminders(v)}
            label="本次出发提醒"
            description={
              isNative
                ? "使用系统本地通知，实际呈现受系统设置影响。"
                : "网页内倒计时与提醒，需保持页面打开。"
            }
          />
          <div className="detail-bottom-actions">
            {trip.remindersEnabled && plan && (
              <Button
                variant="ghost"
                icon="clock"
                onClick={() => {
                  try {
                    update(snoozeTrip(trip));
                    notify("5 分钟后再次提醒");
                  } catch (e) {
                    notify((e as Error).message);
                  }
                }}
              >
                5 分钟后提醒
              </Button>
            )}
            <Button variant="ghost" onClick={() => setConfirm("cancel")}>
              取消行程
            </Button>
          </div>
        </section>
      )}
      {trip.feedback && (
        <div className="feedback-result">
          <Icon name="heart" size={18} />
          <div>
            <strong>
              {trip.feedback.missing === null
                ? "本次未填写反馈"
                : trip.feedback.missing
                  ? "本次有遗漏"
                  : "你反馈：这次都带好了"}
            </strong>
            {trip.feedback.note && <p>{trip.feedback.note}</p>}
          </div>
        </div>
      )}
    </Modal>
  );
}
