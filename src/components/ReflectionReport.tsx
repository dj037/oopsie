import { tripReflection } from "../../shared/reflection";
import type { Trip } from "../../shared/domain";
import { Icon, dateText } from "./ui";
export function ReflectionReport({ trips }: { trips: Trip[] }) {
  const r = tripReflection(trips);
  return (
    <section className="card reflection-report">
      <h2>
        <Icon name="checks" size={20} />
        行程复盘报告
      </h2>
      <p className="title-english">Your preparation insights</p>
      <p className="section-description">
        根据已完成行程的出发记录和你的反馈生成。
      </p>
      <div className="report-metrics">
        <div>
          <strong>{r.completed}</strong>
          <span>已完成行程</span>
        </div>
        <div>
          <strong>
            {r.timed ? `${Math.round((r.onTime / r.timed) * 100)}%` : "—"}
          </strong>
          <span>按时出发</span>
        </div>
        <div>
          <strong>
            {r.averagePreparation === null ? "—" : `${r.averagePreparation}分`}
          </strong>
          <span>平均准备</span>
        </div>
      </div>
      <div className="report-suggestions">
        {r.suggestions.map((s) => (
          <article key={s.title}>
            <Icon name="sparkles" size={16} />
            <div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          </article>
        ))}
      </div>
      {r.recent.length > 0 && (
        <details>
          <summary>最近的复盘记录</summary>
          {r.recent.map((t) => (
            <div className="reflection-record" key={t.id}>
              <strong>{t.title}</strong>
              <small>
                {dateText(t.updatedAt)} ·{" "}
                {t.feedback?.missing === true
                  ? "记录有遗漏"
                  : t.feedback?.missing === false
                    ? "反馈没有遗漏"
                    : "未填写遗漏反馈"}
              </small>
              {t.feedback?.note && <p>{t.feedback.note}</p>}
            </div>
          ))}
        </details>
      )}
      <p className="fine-print">
        按时率仅统计有计划时间及实际出发时间的行程；平均准备从点击开始准备到确认出发计算。
      </p>
    </section>
  );
}
