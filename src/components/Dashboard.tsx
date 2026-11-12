import { useStore } from "../lib/store";
import {
  calculatePlan,
  itemStats,
  mapUrl,
  type Trip,
} from "../../shared/domain";
import { preparationMood } from "../../shared/reflection";
import { COMPLETION_POINTS } from "../../shared/rewards";
import { Icon, Button, timeText, dateText, PageTitle } from "./ui";
import { ClockFace, RouteArt } from "./Artwork";

export function TripCard({
  trip,
  onOpen,
  active = false,
}: {
  trip: Trip;
  onOpen: () => void;
  active?: boolean;
}) {
  const plan = calculatePlan(trip),
    stats = itemStats(trip);
  const state =
    trip.status === "completed"
      ? "已完成"
      : trip.status === "cancelled"
        ? "已取消"
        : trip.status === "departed"
          ? "行程中"
          : active
            ? "正在准备"
            : "待出发";
  return (
    <button
      className={`schedule-ticket ${trip.status} ${active ? "preparing" : ""}`}
      onClick={onOpen}
    >
      <span>
        <strong>{trip.title}</strong>
        <small>{state}</small>
      </span>
      <span>
        <time>
          {plan
            ? `${timeText(plan.prepare)} 准备 · ${timeText(plan.departure)} 出发`
            : "出发时间待补充"}
        </time>
        <small>
          {trip.status === "planned"
            ? `${stats.pending.length} 件必带待检查`
            : "查看记录"}
        </small>
      </span>
      <em>
        {dateText(trip.scheduledAt)} · {trip.destination || "目的地待补充"}
      </em>
    </button>
  );
}

export function Dashboard({
  now,
  onOpen,
  onTrips,
  onScan,
}: {
  now: number;
  onOpen: (id: string) => void;
  onTrips: () => void;
  onScan: (tripId: string, itemId: string) => void;
}) {
  const { data } = useStore();
  const trip = data.trips.find(
    (t) =>
      t.id === data.activeTripId &&
      (t.status === "planned" || t.status === "departed"),
  );
  if (!trip)
    return (
      <div className="departure-page">
        <PageTitle title="出发时钟" english="Your preparation clock" />
        <div className="clock-empty">
          <ClockFace minutes={0} empty />
          <h2>先选择一条要准备的行程</h2>
          <p>
            在首页打开待出发行程，查看清单并点击「确认开始准备行程」，时钟就会一直跟随它。
          </p>
          <Button icon="calendar" onClick={onTrips}>
            去首页选择行程
          </Button>
        </div>
      </div>
    );
  const plan = calculatePlan(trip),
    delta = plan ? plan.departure - now : 0;
  const mood = preparationMood(plan?.departure ?? null, now);
  const pending = trip.items.filter((i) => i.state === "pending"),
    confirmed = trip.items.filter((i) => i.state === "confirmed").length;
  return (
    <div className="departure-page linked-clock-page">
      <PageTitle
        title={trip.status === "departed" ? "行程进行中" : "正在准备"}
        english={
          trip.status === "departed"
            ? "Enjoy your trip"
            : "One trip. Everything ready."
        }
      />
      <button className="active-trip-heading" onClick={() => onOpen(trip.id)}>
        <strong>{trip.title}</strong>
        <span>
          {trip.status === "departed" ? "查看并完成行程" : "查看清单与计划"}
          <Icon name="chevron" size={14} />
        </span>
      </button>
      {trip.status === "planned" ? (
        <>
          <ClockFace
            minutes={Math.ceil(Math.abs(delta) / 60000)}
            late={delta <= 0 && !!plan}
            empty={!plan}
            mood={mood}
          />
          <p className={`mood-caption ${mood}`}>
            {!plan
              ? "补充出发时间后显示倒计时"
              : mood === "relaxed"
                ? "时间充足，小龙虾陪你慢慢准备。"
                : mood === "anxious"
                  ? "只剩 5 分钟以内，小龙虾着急啦！"
                  : "已经超时，小龙虾煮晕了，带齐物品再出发。"}
          </p>
        </>
      ) : (
        <div className="on-the-way">
          <Icon name="navigation" size={34} />
          <h2>出发啦，一路顺利</h2>
          <p>
            抵达后完成行程即可获得 {COMPLETION_POINTS}{" "}
            积分，也可以留下这次的准备心得。
          </p>
          <Button onClick={() => onOpen(trip.id)}>完成行程与复盘</Button>
        </div>
      )}
      <section className="departure-panel">
        <div className="checklist-caption">
          <div>
            <strong>物品检查清单</strong>
            <small className="title-english">Packing checklist</small>
          </div>
          <span>
            {confirmed}/{trip.items.length} 已确认
          </span>
        </div>
        <p className="checklist-help">
          {trip.status === "planned"
            ? "方框仅显示确认结果。点击下方扫描按钮，识别成功后才会打勾。"
            : "这里保留出发时的物品确认记录，完成行程后可在复盘中查看。"}
        </p>
        <div className="clock-checklist">
          {trip.items.map((i) => (
            <div key={i.id} className={`clock-item ${i.state}`}>
              <span
                role="checkbox"
                aria-checked={i.state === "confirmed"}
                aria-disabled="true"
                aria-label={`${i.name}携带状态`}
                className="scan-checkbox"
              >
                {i.state === "confirmed" ? (
                  <Icon name="check" size={18} />
                ) : i.state === "waived" ? (
                  <Icon name="minus" size={14} />
                ) : null}
              </span>
              <span>
                <strong>
                  {i.name}
                  {i.quantity > 1 ? ` ×${i.quantity}` : ""}
                </strong>
                <small>
                  {i.state === "confirmed"
                    ? "已扫描确认"
                    : i.state === "waived"
                      ? "本次不带"
                      : i.required
                        ? "必带 · 待扫描"
                        : "建议 · 待扫描"}
                </small>
              </span>
              {i.state === "pending" && trip.status === "planned" && (
                <button
                  aria-label={`扫描${i.name}`}
                  onClick={() => onScan(trip.id, i.id)}
                >
                  <Icon name="camera" size={17} />
                </button>
              )}
            </div>
          ))}
        </div>
        {!trip.items.length && (
          <p className="fine-print">清单还没有物品，可以打开行程补充。</p>
        )}
        {trip.status === "planned" && (
          <Button
            className="full scan-primary"
            icon={pending.length ? "camera" : "navigation"}
            onClick={() =>
              pending[0] ? onScan(trip.id, pending[0].id) : onOpen(trip.id)
            }
          >
            {pending.length
              ? "打开手机扫描 · 逐项确认"
              : "清单检查完毕 · 确认出发"}
          </Button>
        )}
        <button className="clock-edit-link" onClick={() => onOpen(trip.id)}>
          {trip.status === "planned"
            ? "补充物品 / 查看准备时间轴"
            : "查看清单与准备时间轴"}{" "}
          <Icon name="chevron" size={14} />
        </button>
      </section>
      <section className="clock-route">
        <h2>
          出发规划<small className="title-english">Your departure plan</small>
        </h2>
        <p>
          {plan
            ? `${timeText(plan.prepare)} 开始准备 · ${timeText(plan.departure)} 预计出发`
            : "尚未设置完整的出发时间"}
        </p>
        {trip.destination && (
          <>
            <div className="map-preview">
              <RouteArt />
              <span className="route-caption">
                {trip.destination}
                <small>导航示意</small>
              </span>
            </div>
            <a
              className="map-open"
              href={mapUrl(trip)}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="navigation" size={16} />
              打开地图导航
            </a>
          </>
        )}
      </section>
      <button className="review-link" onClick={onTrips}>
        返回首页选择其他行程 <Icon name="arrow" size={16} />
      </button>
    </div>
  );
}
