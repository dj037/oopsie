import { useEffect, useRef, useState, type CSSProperties } from "react";

/** Original lobster asset with the clock / bowl / blanket treatments in the reference. */
export function Lobster({
  pose = "happy",
  className = "",
}: {
  pose?: "happy" | "thinking" | "clock" | "sleep" | "bowl" | "late";
  className?: string;
}) {
  return (
    <div className={`lobster-art ${pose} ${className}`} aria-hidden="true">
      {pose === "clock" && <span className="lobster-alarm">◷</span>}
      {pose === "thinking" && <span className="lobster-question">?</span>}
      {pose === "sleep" && <span className="lobster-zzz">z z Z</span>}
      <img src="/assets/mascot.png" alt="" />
      {(pose === "bowl" || pose === "late") && (
        <>
          <span className="steam s1" />
          <span className="steam s2" />
          <span className="lobster-bowl" />
        </>
      )}
      {pose === "sleep" && <span className="lobster-blanket" />}
    </div>
  );
}
export function ClockFace({
  minutes,
  late = false,
  empty = false,
  sleeping = false,
  mood = "relaxed",
}: {
  minutes: number;
  late?: boolean;
  empty?: boolean;
  sleeping?: boolean;
  mood?: "relaxed" | "anxious" | "cooked";
}) {
  const level = mood === "relaxed" ? "calm" : "urgent";
  return (
    <div
      className={`reference-clock ${level} ${late ? "late" : ""} ${sleeping ? "sleeping" : ""}`}
    >
      <div className="clock-rim">
        <div className="clock-face">
          {Array.from({ length: 12 }, (_, n) => (
            <i
              key={n}
              className="clock-tick"
              style={{ "--angle": `${n * 30}deg` } as CSSProperties}
            />
          ))}
          <span className="clock-hand" />
          {sleeping ? (
            <Lobster pose="sleep" />
          ) : (
            <div className="clock-copy" aria-live="off">
              <strong
                className={
                  !empty && minutes >= 60 && minutes < 1440
                    ? "clock-hours"
                    : undefined
                }
              >
                {empty
                  ? "准备好了吗"
                  : minutes >= 1440
                    ? `${Math.floor(minutes / 1440)} 天`
                    : minutes >= 60
                      ? `${Math.floor(minutes / 60)}时${minutes % 60}分`
                      : `${minutes} 分钟`}
              </strong>
              <b>{empty ? "从容出发" : late ? "已超时" : "距出发"}</b>
              <span>
                {empty
                  ? "Ready when you are"
                  : late
                    ? "Running late"
                    : "Time to departure"}
              </span>
            </div>
          )}
        </div>
      </div>
      {!sleeping && <PreparationLobster mood={mood} />}
    </div>
  );
}
type LobsterMood = "relaxed" | "anxious" | "cooked";
const lobsterMoods = {
  relaxed: { label: "悠闲的小龙虾", reaction: "晃一晃，不慌张～" },
  anxious: { label: "焦急的小龙虾", reaction: "哎呀，要熟啦！" },
  cooked: { label: "煮晕的小龙虾", reaction: "让我躺一小会儿…" },
};

export function PreparationLobster({ mood }: { mood: LobsterMood }) {
  const lastMood = useRef(mood);
  const [previous, setPrevious] = useState<LobsterMood | null>(null);
  const [reaction, setReaction] = useState(0);
  const [interacting, setInteracting] = useState(false);
  useEffect(() => {
    for (const state of ["relaxed", "anxious", "cooked"]) {
      const image = new Image();
      image.src = `/assets/lobster-${state}.png`;
    }
  }, []);
  useEffect(() => {
    if (lastMood.current === mood) return;
    setPrevious(lastMood.current);
    lastMood.current = mood;
    const timer = window.setTimeout(() => setPrevious(null), 650);
    return () => window.clearTimeout(timer);
  }, [mood]);
  useEffect(() => {
    if (!reaction) return;
    setInteracting(true);
    const timer = window.setTimeout(() => setInteracting(false), 1400);
    return () => window.clearTimeout(timer);
  }, [reaction]);
  const react = () => setReaction((n) => n + 1);
  return (
    <div className={`preparation-lobster ${mood}`} data-mood={mood}>
      <button
        type="button"
        className="lobster-touch-target"
        aria-label={`逗逗${lobsterMoods[mood].label}`}
        onPointerEnter={(e) => e.pointerType === "mouse" && react()}
        onFocus={react}
        onClick={react}
      >
        {previous && (
          <span
            className={`lobster-previous ${previous}`}
            key={`previous-${previous}`}
            aria-hidden="true"
          >
            <PreparationLobsterArt mood={previous} />
          </span>
        )}
        <span className={`lobster-stage ${mood}`} key={mood}>
          <span className="lobster-idle">
            <span
              className={`lobster-reaction ${reaction ? "play" : ""}`}
              key={reaction}
            >
              <PreparationLobsterArt mood={mood} />
            </span>
          </span>
        </span>
        {previous && (
          <span
            className="lobster-poof"
            key={`poof-${mood}`}
            aria-hidden="true"
          >
            <i />
            <i />
            <i />
            <b>✦</b>
            <b>✧</b>
          </span>
        )}
        <span
          className={`lobster-bubble ${interacting ? "visible" : ""}`}
          aria-hidden="true"
        >
          {lobsterMoods[mood].reaction}
        </span>
      </button>
    </div>
  );
}
function PreparationLobsterArt({ mood }: { mood: LobsterMood }) {
  return (
    <img
      src={`/assets/lobster-${mood}.png`}
      alt=""
      width="360"
      height="380"
      draggable={false}
    />
  );
}

export function RouteArt() {
  return (
    <svg
      className="route-art"
      viewBox="0 0 360 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect width="360" height="100" fill="#f1f0e7" />
      <path
        d="M-20 90Q100 10 180 60T400 10"
        stroke="#cde1e8"
        strokeWidth="16"
        fill="none"
      />
      <path
        d="M20 0L80 100M120 -10L150 110M220 -10L185 110M310 0L285 100M0 24L360 34M0 72L360 65"
        stroke="#fff"
        strokeWidth="10"
      />
      <path d="M0 54L360 48M250 0L245 100" stroke="#dac99b" strokeWidth="4" />
      <path
        d="M54 78L104 46L238 46L276 21"
        fill="none"
        stroke="#eea338"
        strokeWidth="4"
        strokeDasharray="5 4"
      />
      <circle cx="54" cy="78" r="5" fill="#6d9c8f" />
      <circle cx="276" cy="21" r="6" fill="#ed9730" />
    </svg>
  );
}
