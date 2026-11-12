import { useState } from "react";
import { useStore } from "../lib/store";
import { calculatePlan } from "../../shared/domain";
import { Button, Icon, IconButton, Empty, dayKey, PageTitle } from "./ui";
import { TripCard } from "./Dashboard";
import { Lobster } from "./Artwork";
export function Trips({
  onCreate,
  onOpen,
}: {
  onCreate: (text?: string) => void;
  onOpen: (id: string) => void;
}) {
  const { data } = useStore();
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [text, setText] = useState("");
  const [selected, setSelected] = useState(""),
    [view, setView] = useState<"calendar" | "review">("calendar"),
    [filter, setFilter] = useState("upcoming"),
    [search, setSearch] = useState("");
  const first = (month.getDay() + 6) % 7;
  const count = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const trips = data.trips
    .filter(
      (t) =>
        filter === "all" ||
        (filter === "history"
          ? t.status === "completed" || t.status === "cancelled"
          : t.status === "planned" || t.status === "departed"),
    )
    .filter((t) => !selected || dayKey(t.scheduledAt) === selected)
    .filter((t) =>
      (t.title + t.destination + t.items.map((i) => i.name).join(" "))
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        (calculatePlan(a)?.departure ?? Infinity) -
        (calculatePlan(b)?.departure ?? Infinity),
    );
  return (
    <div className="schedule-page">
      <section className="new-trip-hero">
        <PageTitle title="添加新的行程" english="Plan your next outing" />
        <p>告诉我去哪、几点到，准备清单一起安排。</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onCreate(text);
          }}
        >
          <label className="sr-only" htmlFor="home-scene">
            描述外出行程
          </label>
          <textarea
            id="home-scene"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="明天 9 点去公司汇报，地铁 40 分钟，要带电脑…"
          />
          <Button type="submit" icon="plus" className="full">
            添加行程 · 生成准备清单
          </Button>
        </form>
      </section>
      <div className="home-section-title">
        <h2>我的行程</h2>
        <p className="title-english">Your schedule</p>
      </div>
      <div className="schedule-switch">
        <button
          className={view === "calendar" ? "active" : ""}
          onClick={() => setView("calendar")}
        >
          <Icon name="calendar" size={16} />
          日历
        </button>
        <button
          className={view === "review" ? "active" : ""}
          onClick={() => {
            setView("review");
            setSelected("");
          }}
        >
          行程总览
        </button>
      </div>
      {view === "calendar" && (
        <div className="month-calendar">
          <div className="month-title">
            <IconButton
              name="back"
              label="上个月"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            />
            <strong>
              {month.toLocaleDateString("zh-CN", {
                month: "long",
                year: "numeric",
              })}
            </strong>
            <IconButton
              name="arrow"
              label="下个月"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            />
          </div>
          <div className="month-days">
            {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
              <small key={d}>{d}</small>
            ))}
            {Array.from({ length: first }, (_, i) => (
              <span key={`empty-${i}`} />
            ))}
            {Array.from({ length: count }, (_, i) => {
              const d = new Date(
                  month.getFullYear(),
                  month.getMonth(),
                  i + 1,
                  12,
                ),
                key = dayKey(d.toISOString()),
                has = data.trips.some((t) => dayKey(t.scheduledAt) === key);
              return (
                <button
                  key={key}
                  aria-label={`${key}${has ? " 有行程" : ""}`}
                  aria-pressed={selected === key}
                  className={`${selected === key ? "selected" : ""} ${key === dayKey(new Date().toISOString()) ? "today" : ""} ${has ? "has-trip" : ""}`}
                  onClick={() => setSelected(selected === key ? "" : key)}
                >
                  <span>{i + 1}</span>
                  {has && <i />}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="schedule-filter">
        <div className="tabs">
          {[
            ["upcoming", "待出发"],
            ["history", "历史行程"],
            ["all", "全部"],
          ].map(([v, label]) => (
            <button
              key={v}
              className={filter === v ? "active" : ""}
              onClick={() => setFilter(v)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="search-input">
          <Icon name="search" size={15} />
          <input
            aria-label="搜索行程"
            placeholder="搜索行程、地点或物品"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {selected && (
        <button className="clear-date" onClick={() => setSelected("")}>
          {selected} · 清除日期筛选 <Icon name="x" size={13} />
        </button>
      )}
      <div className="schedule-list">
        {trips.length ? (
          trips.map((t) => (
            <TripCard
              key={t.id}
              trip={t}
              active={data.activeTripId === t.id}
              onOpen={() => onOpen(t.id)}
            />
          ))
        ) : (
          <Empty
            icon="calendar"
            title={filter === "history" ? "还没有历史行程" : "还没有待出发行程"}
            description="创建一个行程，让 Oopsie 帮你准备。"
          >
            <Button variant="secondary" onClick={() => onCreate()}>
              创建行程
            </Button>
          </Empty>
        )}
      </div>
    </div>
  );
}
