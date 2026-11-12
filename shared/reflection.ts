import { calculatePlan, type Trip } from "./domain";

export function preparationMood(departure: number | null, now: number) {
  if (departure === null) return "relaxed" as const;
  if (departure <= now) return "cooked" as const;
  return departure - now <= 300_000
    ? ("anxious" as const)
    : ("relaxed" as const);
}

export function tripReflection(trips: Trip[]) {
  const completed = trips.filter((t) => t.status === "completed");
  const timed = completed.filter((t) => calculatePlan(t) && t.departedAt);
  const late = timed.filter(
    (t) => Date.parse(t.departedAt!) > calculatePlan(t)!.departure,
  );
  const missing = completed.filter(
    (t) => t.missingAtDeparture.length > 0 || t.feedback?.missing === true,
  );
  const started = completed.filter(
    (t) => t.preparationStartedAt && t.departedAt,
  );
  const minutes = started.map((t) =>
    Math.max(
      0,
      (Date.parse(t.departedAt!) - Date.parse(t.preparationStartedAt!)) / 60000,
    ),
  );
  const frequency = new Map<string, number>();
  for (const t of completed)
    for (const name of new Set(t.missingAtDeparture))
      frequency.set(name, (frequency.get(name) || 0) + 1);
  const forgotten = [...frequency].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const suggestions: { title: string; text: string }[] = [];
  if (!completed.length)
    suggestions.push({
      title: "完成一次，开始了解自己的节奏",
      text: "完成行程后，记录是否忘带物品。这里会根据实际出发时间、扫描记录与反馈生成建议。",
    });
  if (late.length) {
    const avg = Math.ceil(
      late.reduce(
        (sum, t) =>
          sum +
          (Date.parse(t.departedAt!) - calculatePlan(t)!.departure) / 60000,
        0,
      ) / late.length,
    );
    suggestions.push({
      title: "把准备时间再往前挪一点",
      text: `有 ${late.length} 次晚于计划出发，平均晚 ${avg} 分钟。下次可提前 ${Math.min(30, Math.max(5, avg))} 分钟开始准备，并为最后一次检查留出时间。`,
    });
  }
  if (forgotten.length)
    suggestions.push({
      title: "把容易漏掉的东西设为常带必带",
      text: `出发时未确认最多的是 ${forgotten.map(([name, n]) => `${name}（${n} 次）`).join("、")}。把它们放在固定位置，并在出门前逐一扫描。`,
    });
  else if (missing.length)
    suggestions.push({
      title: "按复盘备注补全清单",
      text: `你记录了 ${missing.length} 次遗漏。把反馈里提到的物品加入常带清单，下次生成行程时会自动带入。`,
    });
  if (completed.length && !missing.length)
    suggestions.push({
      title: "继续保持出门前检查",
      text: `已完成的 ${completed.length} 条行程没有记录遗漏。反馈为空的行程仅表示未记录，建议每次结束后补一句真实体验。`,
    });
  const scanned = completed.reduce(
    (n, t) =>
      n +
      t.items.filter((i) => i.state === "confirmed" && i.verification).length,
    0,
  );
  const total = completed.reduce((n, t) => n + t.items.length, 0);
  if (total && scanned < total)
    suggestions.push({
      title: "让确认发生在装包之前",
      text: `历史清单共 ${total} 项，其中 ${scanned} 项有拍摄识别记录。下一次先扫描，再放入包中；不带的物品单独备注。`,
    });
  return {
    completed: completed.length,
    timed: timed.length,
    onTime: timed.length - late.length,
    missing: missing.length,
    averagePreparation: minutes.length
      ? Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length)
      : null,
    suggestions,
    recent: [...completed]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 3),
  };
}
