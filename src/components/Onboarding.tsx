import { useState } from "react";
import { Lobster } from "./Artwork";
import { Button, Icon } from "./ui";
const slides = [
  {
    heading: (
      <>
        The best time to
        <br />
        <strong>start is now</strong>
      </>
    ),
    title: "从容出发，从现在开始",
    eyebrow: "你的出发好伙伴",
    detail: "从容出发，从现在开始。告诉我你的安排，一起把重要的东西准备好。",
    pose: "happy",
  },
  {
    heading: (
      <>
        Develop
        <br />
        <strong>good habits</strong>
      </>
    ),
    title: "养成出门前准备的习惯",
    eyebrow: "给日常多一点从容",
    detail: "用准备时间轴和出发提醒，养成出门前检查物品的小习惯。",
    pose: "happy",
  },
  {
    heading: (
      <>
        Track
        <br />
        <strong>your progress</strong>
      </>
    ),
    title: "每一件，都认真确认",
    eyebrow: "记录你的准备进度",
    detail: "打开相机，对准要带的物品。识别通过后，再把它放进包里。",
    pose: "thinking",
  },
  {
    heading: (
      <>
        Won’t be
        <br />
        <strong>forgetting a thing!</strong>
      </>
    ),
    title: "重要的东西，不再忘记",
    eyebrow: "重要的东西，我帮你记着",
    detail: "留一点准备时间，少一点临时匆忙。下一次出发，准备好了。",
    pose: "clock",
  },
] as const;
export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const s = slides[step];
  return (
    <div className={`onboarding step-${step}`}>
      <button className="onboarding-skip" onClick={onDone}>
        跳过 <Icon name="arrow" size={15} />
      </button>
      <div className="onboarding-art">
        <Lobster pose={s.pose} />
        {step === 0 && <span className="welcome-star">✦</span>}
      </div>
      <div className="onboarding-copy">
        <p className="onboarding-eyebrow">{s.eyebrow}</p>
        <h1>{s.title}</h1>
        <div className="onboarding-english">{s.heading}</div>
        <p>{s.detail}</p>
        <div className="onboarding-dots">
          {slides.map((_, n) => (
            <button
              key={n}
              aria-label={`第 ${n + 1} 页引导`}
              className={step === n ? "active" : ""}
              onClick={() => setStep(n)}
            />
          ))}
        </div>
        <Button onClick={() => (step < 3 ? setStep(step + 1) : onDone())}>
          {step === 0 ? "开始体验" : step === 3 ? "使用邮箱登录" : "继续"}
          <Icon name="arrow" size={16} />
        </Button>
        <button className="onboarding-login" onClick={onDone}>
          已有账号？登录
        </button>
      </div>
    </div>
  );
}
