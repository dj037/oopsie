import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { newId } from "../../shared/domain";
import { COMPLETION_POINTS } from "../../shared/rewards";
import { ReflectionReport } from "./ReflectionReport";
import {
  Button,
  Icon,
  IconButton,
  Confirm,
  Toggle,
  Badge,
  Modal,
  Avatar,
  PageTitle,
  type IconName,
} from "./ui";
import {
  isNative,
  enableAudio,
  playChime,
  testNotification,
  requestNotifications,
  cancelAllNotifications,
  type NoticeStatus,
} from "../lib/notifications";
export function Profile({
  status,
  onRefresh,
  notify,
  onShop,
}: {
  status: NoticeStatus;
  onRefresh: () => void;
  notify: (m: string) => void;
  onShop: () => void;
}) {
  const {
    user,
    data,
    wallet,
    updateProfile,
    setPreferences,
    clearData,
    logout,
  } = useStore();
  const [editingProfile, setEditingProfile] = useState(false),
    [displayName, setDisplayName] = useState(user?.name || ""),
    [avatar, setAvatar] = useState(user?.avatar || ""),
    [profileError, setProfileError] = useState(""),
    [profileBusy, setProfileBusy] = useState(false);
  async function selectAvatar(file: File | undefined) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 8_000_000
    ) {
      setProfileError("请选择 8 MB 以内的 JPG、PNG 或 WebP 图片");
      return;
    }
    setProfileError("");
    setProfileBusy(true);
    try {
      const image = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const side = Math.min(image.width, image.height);
      canvas
        .getContext("2d")!
        .drawImage(
          image,
          (image.width - side) / 2,
          (image.height - side) / 2,
          side,
          side,
          0,
          0,
          256,
          256,
        );
      image.close();
      setAvatar(canvas.toDataURL("image/jpeg", 0.85));
    } catch {
      setProfileError("图片无法读取，请重新选择");
    } finally {
      setProfileBusy(false);
    }
  }
  async function saveProfile() {
    setProfileBusy(true);
    setProfileError("");
    try {
      await updateProfile(displayName.trim(), avatar);
      setEditingProfile(false);
      notify("昵称和头像已保存");
    } catch (e) {
      setProfileError((e as Error).message);
    } finally {
      setProfileBusy(false);
    }
  }
  const [prefs, setPrefs] = useState(data.preferences),
    [name, setName] = useState(""),
    [confirm, setConfirm] = useState<"clear" | "logout" | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setPrefs(data.preferences);
  }, [data.preferences]);
  function saveItems(items: typeof prefs.alwaysItems) {
    const next = { ...prefs, alwaysItems: items };
    setPreferences(next);
    setPrefs(next);
  }
  function addItem() {
    const value = name.trim();
    if (!value) return;
    if (prefs.alwaysItems.length >= 30) {
      notify("最多添加 30 件常带物品");
      return;
    }
    if (
      prefs.alwaysItems.some(
        (i) => i.name.toLocaleLowerCase() === value.toLocaleLowerCase(),
      )
    ) {
      notify("这件物品已经在列表里了");
      return;
    }
    saveItems([
      ...prefs.alwaysItems,
      { id: newId(), name: value, required: true },
    ]);
    setName("");
    notify("已添加并保存，新行程会自动带上它");
  }
  const [ring, setRing] = useState(false);
  const stats = [
    { icon: "calendar", label: "创建行程", value: data.trips.length },
    {
      icon: "checks",
      label: "已结束",
      value: data.trips.filter((t) => t.status === "completed").length,
    },
    { icon: "backpack", label: "常带物品", value: prefs.alwaysItems.length },
  ];
  const statusLabel = {
    "native-ready": "系统通知已授权",
    "web-ready": "浏览器通知已授权",
    denied: "系统通知未授权",
    prompt: "尚未开启系统通知",
    unsupported: "当前环境使用页面内提醒",
    failed: "无法读取通知状态",
  }[status];
  async function save() {
    setPreferences(prefs);
    notify("偏好已保存，会用于新创建的行程");
  }
  async function confirmAction() {
    setBusy(true);
    try {
      if (confirm === "clear") {
        await cancelAllNotifications();
        clearData();
        setPrefs({
          ...data.preferences,
          alwaysItems: [],
          home: "",
          prepareMinutes: 20,
          bufferMinutes: 10,
          leadMinutes: 10,
          sound: true,
          privateNotifications: true,
        });
        notify("账号行程和偏好已清空");
      } else {
        await logout();
        await cancelAllNotifications();
      }
      setConfirm(null);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <PageTitle
          title="我的出发习惯"
          english="Make every departure a little better"
        />
        <Button icon="check" onClick={save}>
          保存偏好
        </Button>
      </div>
      <section className="profile-identity card">
        <Avatar className="large" name={user?.name || ""} src={user?.avatar} />
        <div>
          <h2>{user?.name}</h2>
          <p>{user?.email}</p>
          <Badge tone="green">
            <Icon name="shield" size={12} /> 账号已登录
          </Badge>
        </div>
        <button
          className="edit-profile-button"
          onClick={() => {
            setDisplayName(user?.name || "");
            setAvatar(user?.avatar || "");
            setProfileError("");
            setEditingProfile(true);
          }}
        >
          <Icon name="edit" size={15} />
          编辑昵称与头像
        </button>
        <div className="profile-stats">
          {stats.map((s) => (
            <div key={s.label}>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="profile-points card">
        <div>
          <h2>
            我的积分<small className="title-english">Your reward points</small>
          </h2>
          <strong>
            {wallet.balance}
            <small>分</small>
          </strong>
          <p>
            累计获得 {wallet.earned} 分 · 每完成行程 +{COMPLETION_POINTS} 分
          </p>
        </div>
        <Button onClick={onShop} icon="shop">
          兑换周边
        </Button>
      </section>
      <ReflectionReport trips={data.trips} />
      <div className="profile-grid">
        <section className="card settings-card">
          <div className="card-heading">
            <h2>
              <Icon name="backpack" /> 我的常带物品
            </h2>
            <Badge>{prefs.alwaysItems.length} 件</Badge>
          </div>
          <p className="title-english">Everyday essentials</p>
          <p className="section-description">
            新建行程时自动加入。调整这里，不会改变已有行程。
          </p>
          <div className="personal-items">
            {prefs.alwaysItems.length ? (
              prefs.alwaysItems.map((i) => (
                <div key={i.id}>
                  <span className="personal-item-icon">
                    <Icon name="backpack" size={17} />
                  </span>
                  <strong>{i.name}</strong>
                  <button
                    className={`required-switch ${i.required ? "required" : ""}`}
                    onClick={() =>
                      saveItems(
                        prefs.alwaysItems.map((x) =>
                          x.id === i.id ? { ...x, required: !x.required } : x,
                        ),
                      )
                    }
                  >
                    {i.required ? "必带" : "建议"}
                  </button>
                  <IconButton
                    name="x"
                    label={`移除常带物品${i.name}`}
                    onClick={() =>
                      saveItems(prefs.alwaysItems.filter((x) => x.id !== i.id))
                    }
                  />
                </div>
              ))
            ) : (
              <div className="empty-mini">
                <Icon name="backpack" />
                <p>
                  钥匙、门禁卡、耳机…
                  <br />
                  把你经常要带的东西记在这里。
                </p>
              </div>
            )}
          </div>
          <div className="add-item">
            <Icon name="plus" size={18} />
            <input
              aria-label="常带物品名称"
              placeholder="添加一件常带物品"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  addItem();
                }
              }}
            />
            <button
              disabled={!name.trim() || prefs.alwaysItems.length >= 30}
              onClick={addItem}
            >
              添加
            </button>
          </div>
          <p className="fine-print">添加、删除和必带设置会自动保存。</p>
        </section>
        <section className="card settings-card">
          <div className="card-heading">
            <h2>
              <Icon name="clock" /> 给自己留点余量
            </h2>
          </div>
          <p className="title-english">Make room for a calmer start</p>
          <p className="section-description">
            这些默认值可以在每次创建行程时单独调整。
          </p>
          <label className="field">
            常用出发地
            <input
              placeholder="例如：家，或完整的出发地址"
              maxLength={200}
              value={prefs.home}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, home: e.target.value }))
              }
            />
          </label>
          {(
            [
              [
                "prepareMinutes",
                "准备时长",
                "整理东西，换衣服，不慌不忙",
                1440,
              ],
              ["bufferMinutes", "交通缓冲", "给路上的不确定性留一点时间", 240],
              ["leadMinutes", "提前到达", "比活动开始更早一点到场", 240],
            ] as const
          ).map(([key, label, desc, max]) => (
            <div className="duration-setting" key={key}>
              <div>
                <strong>{label}</strong>
                <p>{desc}</p>
              </div>
              <div className="stepper">
                <button
                  aria-label={`减少${label}`}
                  onClick={() =>
                    setPrefs((p) => ({ ...p, [key]: Math.max(0, p[key] - 5) }))
                  }
                >
                  <Icon name="minus" size={15} />
                </button>
                <input
                  aria-label={`默认${label}`}
                  type="number"
                  min={0}
                  max={max}
                  value={prefs[key]}
                  onChange={(e) =>
                    setPrefs((p) => ({
                      ...p,
                      [key]: Math.min(
                        max,
                        Math.max(0, Math.round(Number(e.target.value))),
                      ),
                    }))
                  }
                />
                <button
                  aria-label={`增加${label}`}
                  onClick={() =>
                    setPrefs((p) => ({
                      ...p,
                      [key]: Math.min(max, p[key] + 5),
                    }))
                  }
                >
                  <Icon name="plus" size={15} />
                </button>
                <span>分钟</span>
              </div>
            </div>
          ))}
        </section>
        <section className="card settings-card">
          <div className="card-heading">
            <h2>
              <Icon name="bell" /> 提醒与声音
            </h2>
            <IconButton
              name="refresh"
              label="刷新通知状态"
              onClick={onRefresh}
            />
          </div>
          <p className="title-english">Reminders & sounds</p>
          <div className="permission-status">
            <span
              className={`status-dot ${status.includes("ready") ? "good" : ""}`}
            />
            <div>
              <strong>{statusLabel}</strong>
              <p>
                {isNative
                  ? "允许通知后，可以在 App 关闭时由系统提醒。"
                  : "网页版需要保持页面打开，关闭页面后不能保证提醒。"}
              </p>
            </div>
          </div>
          <div className="permission-actions">
            <Button
              variant="secondary"
              icon="bell"
              onClick={async () => {
                await requestNotifications();
                onRefresh();
                notify(
                  "已更新通知权限状态；如果被拒绝，请在浏览器或系统设置里调整",
                );
              }}
            >
              开启通知
            </Button>
            <Button
              variant="ghost"
              icon="volume"
              onClick={async () => {
                try {
                  notify(await testNotification(prefs));
                } catch {
                  notify("系统测试通知暂时无法发送，请检查通知权限");
                }
              }}
            >
              测试提醒
            </Button>
          </div>
          <Toggle
            label="提示音"
            description="页面内提醒时播放轻提示音"
            checked={prefs.sound}
            onChange={(sound) => setPrefs((p) => ({ ...p, sound }))}
          />
          <Toggle
            label="锁屏隐藏行程内容"
            description="通知只提示打开 App，不显示具体安排"
            checked={prefs.privateNotifications}
            onChange={(privateNotifications) =>
              setPrefs((p) => ({ ...p, privateNotifications }))
            }
          />
          <p className="fine-print">
            提醒呈现受设备静音、专注模式和系统权限影响，不保证绕过系统限制。
          </p>
        </section>
        <section className="card settings-card">
          <div className="card-heading">
            <h2>
              <Icon name="volume" />
              提示音设置
            </h2>
          </div>
          <p className="title-english">Choose your reminder tone</p>
          <p className="section-description">选择应用内提示音，点一下试听。</p>
          <Button variant="secondary" onClick={() => setRing(true)}>
            选择提示音 ·{" "}
            {{ a: "轻柔提醒", b: "清脆铃声", c: "活力提示" }[prefs.tone]}
          </Button>
        </section>
        <section className="card settings-card account-settings">
          <div className="card-heading">
            <h2>
              <Icon name="shield" /> 账号与数据
            </h2>
          </div>
          <p className="title-english">Account & data</p>
          <div className="account-note">
            <Icon name="lock" />
            <p>
              行程按账号保存到当前服务，离线修改先保存在此设备。邮箱仅作为登录标识。
            </p>
          </div>
          <button className="settings-link" onClick={() => setConfirm("clear")}>
            <span>
              <Icon name="trash" size={19} /> 清空当前账号的行程与偏好
            </span>
            <Icon name="chevron" size={18} />
          </button>
          <button
            className="settings-link"
            onClick={() => setConfirm("logout")}
          >
            <span>
              <Icon name="logout" size={19} /> 退出登录
            </span>
            <Icon name="chevron" size={18} />
          </button>
          <div className="about-oopsie">
            <img src="/assets/mascot.png" alt="" />
            <div>
              <strong>
                Oopsie <Badge>v0.3.1</Badge>
              </strong>
              <p>少一点忘记，多一点从容。</p>
            </div>
          </div>
        </section>
      </div>
      {editingProfile && (
        <Modal
          title="编辑个人资料"
          subtitle="Make Oopsie yours"
          onClose={() => !profileBusy && setEditingProfile(false)}
          footer={
            <Button
              disabled={profileBusy || !displayName.trim()}
              onClick={() => void saveProfile()}
            >
              {profileBusy ? "正在保存…" : "保存个人资料"}
            </Button>
          }
        >
          <div className="avatar-editor">
            <Avatar name={displayName || "我"} src={avatar} className="large" />
            <label className="avatar-upload">
              选择头像
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={profileBusy}
                aria-label="上传自定义头像"
                onChange={(e) => void selectAvatar(e.target.files?.[0])}
              />
            </label>
            {avatar && (
              <button onClick={() => setAvatar("")}>恢复默认头像</button>
            )}
          </div>
          <label className="field">
            昵称
            <input
              aria-label="自定义昵称"
              value={displayName}
              maxLength={40}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="希望我们怎么称呼你"
            />
          </label>
          <p className="fine-print">
            头像会裁成正方形并随账号保存。支持 JPG、PNG、WebP，最大 8 MB。
          </p>
          {profileError && (
            <p className="error-box" role="alert">
              {profileError}
            </p>
          )}
        </Modal>
      )}
      {ring && (
        <Modal
          title="提示音设置"
          subtitle="Ringtone settings"
          eyebrow="应用内提醒声音"
          onClose={() => setRing(false)}
          footer={
            <Button
              onClick={() => {
                setPreferences(prefs);
                setRing(false);
                notify("提示音已保存");
              }}
            >
              确认选择
            </Button>
          }
        >
          <div className="ring-options">
            {(["a", "b", "c"] as const).map((tone) => (
              <button
                key={tone}
                className={prefs.tone === tone ? "active" : ""}
                onClick={() => {
                  setPrefs((p) => ({ ...p, tone }));
                  enableAudio();
                  playChime(tone);
                }}
              >
                <Icon name="volume" size={17} />
                {{ a: "轻柔提醒", b: "清脆铃声", c: "活力提示" }[tone]}
              </button>
            ))}
          </div>
          <p className="fine-print">
            用于应用打开时的提示。锁屏系统通知沿用设备默认声音。
          </p>
        </Modal>
      )}
      {confirm && (
        <Confirm
          title={
            confirm === "clear" ? "清空当前账号的数据？" : "准备退出登录？"
          }
          description={
            confirm === "clear"
              ? "当前账号的全部行程、物品记录和偏好将被删除，相关提醒也会停止。账号、积分和兑换记录会保留。"
              : "已同步的行程会保留，下次登录后可以继续使用。本机提醒将停止。"
          }
          confirmText={
            busy ? "处理中…" : confirm === "clear" ? "确认清空" : "退出登录"
          }
          onClose={() => !busy && setConfirm(null)}
          onConfirm={() => !busy && void confirmAction()}
          danger={confirm === "clear"}
        />
      )}
    </>
  );
}
