import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useStore } from "../lib/store";
import { Onboarding } from "./Onboarding";
import { Button, Icon, Logo } from "./ui";
export function Auth() {
  const { authenticate } = useStore();
  const [welcome, setWelcome] = useState(
    !localStorage.getItem("oopsie:onboarded:v2"),
  );
  const finishWelcome = () => {
    localStorage.setItem("oopsie:onboarded:v2", "1");
    setWelcome(false);
  };
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState(""),
    [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      authenticate(
        mode === "login"
          ? await api.login(email, password)
          : await api.register(name, email, password),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "暂时无法登录，请重试");
    } finally {
      setBusy(false);
    }
  }
  if (welcome) return <Onboarding onDone={finishWelcome} />;
  return (
    <div className="auth-page">
      <section className="auth-form-wrap">
        <button className="auth-back" onClick={() => setWelcome(true)}>
          <Icon name="back" size={18} /> 返回
        </button>
        <div className="auth-form">
          <h2>{mode === "login" ? "欢迎回来" : "创建你的账号"}</h2>
          <p>
            {mode === "login"
              ? "Welcome back to Oopsie"
              : "Your next adventure starts here"}
          </p>
          <div className="auth-tabs" aria-label="账号操作">
            <button
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              登录
            </button>
            <button
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              注册账号
            </button>
          </div>
          <form onSubmit={submit}>
            {mode === "register" && (
              <label className="field">
                怎么称呼你
                <div className="input-with-icon">
                  <Icon name="user" />
                  <input
                    required
                    maxLength={40}
                    autoComplete="nickname"
                    placeholder="你的昵称"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </label>
            )}
            <label className="field">
              邮箱
              <div className="input-with-icon">
                <Icon name="mail" />
                <input
                  required
                  type="email"
                  maxLength={200}
                  autoComplete="email"
                  placeholder="hello@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </label>
            <label className="field">
              密码
              <div className="input-with-icon">
                <Icon name="lock" />
                <input
                  required
                  minLength={8}
                  maxLength={128}
                  type={visible ? "text" : "password"}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  placeholder="至少 8 位字符"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="password-eye"
                  aria-label={visible ? "隐藏密码" : "显示密码"}
                  onClick={() => setVisible(!visible)}
                >
                  <Icon name={visible ? "eyeOff" : "eye"} size={18} />
                </button>
              </div>
            </label>
            {error && (
              <div className="error-box" role="alert">
                <Icon name="alert" size={18} />
                {error}
              </div>
            )}
            <Button
              type="submit"
              className="full"
              disabled={busy}
              icon={busy ? "loader" : "arrow"}
            >
              {busy
                ? "正在连接…"
                : mode === "login"
                  ? "登录，准备出发"
                  : "创建账号"}
            </Button>
          </form>
          <div className="auth-switch">
            {mode === "login" ? "还没有账号？" : "已经有账号？"}
            <button
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
              }}
            >
              {mode === "login" ? "立即注册" : "去登录"}
              <Icon name="arrow" size={14} />
            </button>
          </div>
          <div className="auth-info">
            <Icon name="lock" size={15} />
            <span>
              {import.meta.env.VITE_DEMO_MODE === "true"
                ? "免费体验版：账号和行程是临时数据，服务重启后可能清空。请使用专门的体验密码。"
                : "账号与行程保存在当前服务中，密码加密存储。"}
              <br />
              初步版本暂不提供邮箱验证和密码找回。
            </span>
          </div>
        </div>
        <div className="auth-footer">
          MADE FOR YOUR EVERYDAY ADVENTURES <span>✦</span>
        </div>
      </section>
    </div>
  );
}
