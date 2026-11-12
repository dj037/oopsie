import {
  blankTrip,
  defaultPreferences,
  newItem,
  scenes,
  type Preferences,
  type Item,
  type Trip,
} from "./domain";

type Candidate = [name: string, required: boolean, reason: string];
const templates: Record<string, Candidate[]> = {
  presentation: [
    ["笔记本电脑", true, "用于展示你的方案或演示文件"],
    ["电脑充电器", true, "汇报前给设备留足电量"],
    ["演示资料", true, "提前检查文件能否正常打开"],
    ["转接头", false, "如需连接现场显示设备，请确认接口"],
    ["翻页器", false, "远离电脑演示时可以更从容"],
    ["水杯", false, "汇报前后补充水分"],
  ],
  interview: [
    ["个人简历", true, "准备好面试需要展示的经历"],
    ["作品 / 项目资料", false, "有作品展示环节时携带"],
    ["身份证", false, "如面试方要求身份核验"],
    ["笔与笔记本", false, "记录岗位信息与面试问题"],
    ["水杯", false, "等待面试时补充水分"],
  ],
  work: [
    ["工作资料", true, "今天工作需要的文件和资料"],
    ["笔记本电脑", false, "需要使用个人电脑时携带"],
    ["电脑充电器", false, "携带电脑时检查电量需求"],
    ["门禁卡", false, "如果办公场所需要门禁"],
    ["水杯", false, "日常饮水更方便"],
  ],
  study: [
    ["考试 / 课程资料", true, "按课程或考试要求准备"],
    ["笔与文具", true, "核对允许使用的文具"],
    ["学生证", false, "课程或考试需要时携带"],
    ["准考证", false, "参加需要准考证的考试时核对要求"],
    ["水杯", false, "请确认考场是否允许携带"],
  ],
  gym: [
    ["运动服", true, "选择适合本次运动的衣服"],
    ["运动鞋", true, "保护双脚，让运动更舒适"],
    ["水杯", true, "运动途中及时补水"],
    ["毛巾", false, "擦汗或运动后使用"],
    ["换洗衣物", false, "运动后更换更舒服"],
    ["会员凭证", false, "场馆需要时准备好入场凭证"],
  ],
  travel: [
    ["身份证", true, "按本次交通方式核对所需证件"],
    ["手机充电器", true, "为路上的联络与导航保留电量"],
    ["换洗衣物", false, "按天数和天气选择"],
    ["充电宝", false, "长时间在外可备用，请核对承运要求"],
    ["水杯", false, "途中方便补充水分"],
    ["车票 / 订单", false, "提前确认乘车与住宿信息"],
  ],
  general: [
    ["钥匙", false, "如果需要回家或开门，请记得携带"],
    ["手机", false, "联络、支付和导航时使用"],
    ["水杯", false, "按外出时间决定是否携带"],
  ],
};
const aliasGroups = [
  ["笔记本电脑", "电脑", "笔记本"],
  ["电脑充电器", "电脑电源"],
  ["手机充电器", "手机充电线"],
  ["水杯", "水壶"],
  ["雨伞", "伞"],
  ["个人简历", "简历"],
  ["演示资料", "演示文件", "PPT", "ppt"],
  ["笔与文具", "文具"],
  ["转接头", "转换器", "适配器"],
];
export function canonical(name: string) {
  return aliasGroups.find((g) => g.includes(name))?.[0] || name.trim();
}
function excludedNames(text: string) {
  const result = new Set<string>();
  for (const match of text.matchAll(
    /(?:不需要带|不用带|不要带|不带|无需带|不用携带|不要携带)([^，。；！\n]+)/g,
  )) {
    for (const name of match[1].split(/[、和及与,]/))
      result.add(canonical(name.trim()));
  }
  if (/现场(?:已|会)?(?:有|提供)(?:电脑|设备)|不用(?:自己的)?电脑/.test(text))
    result.add("笔记本电脑");
  return result;
}
export function applyConstraints(items: Item[], text: string): Item[] {
  const excluded = excludedNames(text);
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = canonical(item.name);
    if (
      excluded.has(key) ||
      [...excluded].some((e) => e.length > 1 && key.startsWith(e))
    )
      return false;
    if (
      excluded.has("笔记本电脑") &&
      ["电脑充电器", "转接头", "翻页器"].includes(key)
    )
      return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function chineseNumber(value: string) {
  if (/^\d+$/.test(value)) return Number(value);
  const map: Record<string, number> = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  if (value === "十") return 10;
  if (value.includes("十")) {
    const [a, b] = value.split("十");
    return (a ? map[a] : 1) * 10 + (b ? map[b] : 0);
  }
  return map[value];
}

export function parseScene(text: string) {
  if (/汇报|演示|答辩|展示|presentation|开会|会议/i.test(text))
    return "presentation";
  if (/面试|interview/i.test(text)) return "interview";
  if (/考试|上课|学校|校园|课堂|自习/.test(text)) return "study";
  if (/健身|跑步|瑜伽|运动|gym/i.test(text)) return "gym";
  if (/旅行|旅游|出差|高铁|飞机|香港|深圳.*香港|露营/.test(text))
    return "travel";
  if (/上班|公司|通勤|工作|办公室/.test(text)) return "work";
  return "general";
}

export function generateDraft(
  text: string,
  preferences: Preferences = defaultPreferences,
  now = new Date(),
  offset = -now.getTimezoneOffset(),
): { trip: Trip; notices: string[] } {
  const trip = blankTrip(preferences, now),
    notices: string[] = [];
  trip.generation = "rules";
  trip.description = text;
  trip.scene = parseScene(text);
  trip.title = (
    {
      presentation: "方案汇报",
      interview: "面试赴约",
      study: /考试/.test(text) ? "学校考试" : "上课学习",
      gym: "运动健身",
      travel: "短途出行",
      work: "日常通勤",
      general: "新的外出计划",
    } as Record<string, string>
  )[trip.scene];
  if (/(?:以及|然后|之后|再去|下午.*晚上)/.test(text))
    notices.push(
      "这段描述可能有多个安排。请确认本次先创建哪一个，其他安排可再单独添加。",
    );
  const local = new Date(now.getTime() + offset * 60_000);
  let year = local.getUTCFullYear(),
    month = local.getUTCMonth(),
    day = local.getUTCDate(),
    hasDate = false;
  if (/后天/.test(text)) {
    day += 2;
    hasDate = true;
  } else if (/明天|明早|明晚/.test(text)) {
    day++;
    hasDate = true;
  } else if (/今天|今晚|今早/.test(text)) hasDate = true;
  const date = text.match(/(20\d{2})[年\-/](\d{1,2})[月\-/](\d{1,2})/);
  if (date) {
    year = +date[1];
    month = +date[2] - 1;
    day = +date[3];
    hasDate = true;
  }
  const weekday = text.match(/(下周|本周|周|星期)([一二三四五六日天])/);
  if (weekday && !hasDate) {
    const target = "日一二三四五六".indexOf(
      weekday[2] === "天" ? "日" : weekday[2],
    );
    let delta = (target - local.getUTCDay() + 7) % 7;
    if (weekday[1] === "下周")
      delta = 7 - ((local.getUTCDay() + 6) % 7) + ((target + 6) % 7);
    day += delta;
    hasDate = true;
  }
  const time = text.match(
    /(早上|上午|下午|晚上|中午|凌晨|晚|早)?\s*([\d一二两三四五六七八九十]{1,3})\s*(?:[:：点时])\s*(半|[\d一二三四五六七八九十]{1,3})?/,
  );
  if (time && hasDate) {
    let hour = chineseNumber(time[2]);
    const minute = time[3] === "半" ? 30 : time[3] ? chineseNumber(time[3]) : 0;
    const period = time[1] || (/明晚|今晚/.test(text) ? "晚上" : "");
    if (/下午|晚上|晚|中午/.test(period) && hour < 12) hour += 12;
    if (period === "凌晨" && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute < 60)
      trip.scheduledAt = new Date(
        Date.UTC(year, month, day, hour, minute) - offset * 60_000,
      ).toISOString();
    else notices.push("时间格式需要确认，请在计划里选择日期和时间。");
  }
  if (!trip.scheduledAt)
    notices.push("请补充具体日期和时间，才能倒推出发与准备时间。");
  if (time && /(?:点|时|:\d{2}|：\d{2})\s*(?:半)?\s*(?:就)?出发/.test(text))
    trip.mode = "departure";
  const travel = text.match(
    /(?:通勤|路上|路程|车程|地铁|公交|打车|步行|骑行|开车|大约|约)\s*(?:大约|约|需要|要)?\s*(\d{1,3})\s*(?:分钟|分)/,
  );
  if (travel) trip.travelMinutes = +travel[1];
  if (trip.travelMinutes === null && trip.mode === "arrival")
    notices.push("还需要预计通勤用时；我们不会凭空估算路线。");
  if (/步行|走路/.test(text)) trip.transport = "walking";
  else if (/打车|出租/.test(text)) trip.transport = "taxi";
  else if (/自驾|开车/.test(text)) trip.transport = "driving";
  else if (/骑行|骑车/.test(text)) trip.transport = "cycling";
  const origin = text.match(/从\s*([^，。；\n]{1,30}?)\s*出发/);
  if (origin)
    trip.origin = origin[1] === "家" ? preferences.home || "家" : origin[1];
  const destination = text.match(
    /(?:去|到)\s*([^，。；\n]{1,30}?)(?=做|参加|进行|开会|面试|汇报|上班|考试|上课|运动|健身|旅行|旅游|出差|[，。；\n]|$)/,
  );
  if (destination) trip.destination = destination[1].trim();
  if (!trip.destination && /去健身房/.test(text)) trip.destination = "健身房";
  if (trip.destination)
    notices.push("地点来自你的描述，导航前请确认是完整、准确的地址。");
  const personal = preferences.alwaysItems.map((i) =>
    newItem(i.name, i.required, "personal", "你的常带物品"),
  );
  const generated = (templates[trip.scene] || templates.general).map(
    ([name, required, reason]) => newItem(name, required, "template", reason),
  );
  const explicit: Item[] = [];
  for (const m of text.matchAll(
    /(?:记得带|需要带|要带|带上|携带|必须带)\s*([^，。；！\n]+)/g,
  )) {
    if (/不|无/.test(text.slice(Math.max(0, m.index! - 2), m.index))) continue;
    for (const name of m[1]
      .split(/[、和及与,]/)
      .map((v) => v.trim())
      .filter((v) => v && v.length <= 30))
      explicit.push(
        newItem(canonical(name), true, "user", "你在描述中明确提到"),
      );
  }
  if (
    /需要用(?:自己的)?电脑|用(?:自己的)?电脑/.test(text) &&
    !explicit.some((i) => i.name === "笔记本电脑")
  )
    explicit.push(
      newItem("笔记本电脑", true, "user", "你提到需要使用自己的电脑"),
    );
  // A generic charger is left for the user to identify; avoid a second inferred
  // charger beside it while retaining explicitly distinct phone/laptop chargers.
  const genericCharger = [...explicit, ...personal].some(
    (i) => i.name === "充电器",
  );
  trip.items = applyConstraints(
    [
      ...explicit,
      ...personal,
      ...generated.filter(
        (i) =>
          !genericCharger || !["电脑充电器", "手机充电器"].includes(i.name),
      ),
    ],
    text,
  );
  if (
    trip.items.some((i) => i.name === "笔记本电脑") &&
    !trip.items.some((i) => ["电脑充电器", "充电器"].includes(i.name))
  )
    trip.items.push(
      newItem("电脑充电器", false, "template", "携带电脑时可一并检查充电需求"),
    );
  trip.items = applyConstraints(trip.items, text);
  return { trip, notices };
}

export function sampleTrip(preferences: Preferences, now = new Date()) {
  const { trip } = generateDraft(scenes[1].prompt, preferences, now);
  trip.title = "方案汇报 · 示例行程";
  trip.scheduledAt = new Date(now.getTime() + 80 * 60_000).toISOString();
  trip.destination = "公司（请填写实际地址）";
  trip.origin = preferences.home || "家";
  trip.remindersEnabled = false;
  return trip;
}
