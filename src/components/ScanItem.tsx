import { useEffect, useRef, useState } from "react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { useStore } from "../lib/store";
import { api } from "../lib/api";
import { isNative } from "../lib/notifications";
import { Modal, Button, Icon } from "./ui";
import type { Item } from "../../shared/domain";

export function ScanItem({
  tripId,
  itemId,
  onClose,
  notify,
}: {
  tripId: string;
  itemId: string;
  onClose: () => void;
  notify: (s: string) => void;
}) {
  const { data, retry, confirmScannedItem } = useStore();
  const trip = data.trips.find((t) => t.id === tripId),
    item = trip?.items.find((i) => i.id === itemId);
  const [photo, setPhoto] = useState(""),
    [visionMode, setVisionMode] = useState<"local-clip" | "vision-api" | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [cameraBusy, setCameraBusy] = useState(false),
    [streaming, setStreaming] = useState(false),
    [message, setMessage] = useState(""),
    [passed, setPassed] = useState<Item["verification"]>(null);
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    abort = useRef<AbortController | null>(null),
    alive = useRef(true);
  function stop() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setStreaming(false);
  }
  useEffect(() => {
    alive.current = true;
    void api
      .visionStatus()
      .then((status) => {
        if (alive.current) setVisionMode(status.mode);
      })
      .catch(() => {});
    const hidden = () => {
      if (document.hidden) {
        stream.current?.getTracks().forEach((t) => t.stop());
        stream.current = null;
        setStreaming(false);
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      alive.current = false;
      stream.current?.getTracks().forEach((t) => t.stop());
      abort.current?.abort();
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  async function openCamera() {
    setMessage("");
    setPhoto("");
    setPassed(null);
    setCameraBusy(true);
    try {
      if (isNative) {
        const result = await Camera.getPhoto({
          source: CameraSource.Camera,
          resultType: CameraResultType.DataUrl,
          quality: 80,
          width: 1024,
          height: 1024,
          saveToGallery: false,
          correctOrientation: true,
        });
        if (alive.current && result.dataUrl) setPhoto(result.dataUrl);
      } else {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
          throw new Error("请使用 HTTPS 页面，或在本机 localhost 打开相机。");
        const media = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
          audio: false,
        });
        if (!alive.current) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = media;
        setStreaming(true);
        if (video.current) {
          video.current.srcObject = media;
          await video.current.play();
        }
      }
    } catch (e) {
      if (alive.current) {
        const err = e as Error;
        setMessage(
          err.name === "NotAllowedError"
            ? "相机权限被拒绝。请在浏览器或系统设置中允许相机，再重新打开。"
            : err.name === "NotFoundError"
              ? "没有找到摄像头。请在有摄像头的手机或电脑上使用。"
              : /cancel/i.test(err.message)
                ? "拍摄已取消，物品仍未确认。"
                : err.message || "无法打开相机，请检查设备权限。",
        );
        stop();
      }
    } finally {
      if (alive.current) setCameraBusy(false);
    }
  }
  function capture() {
    const v = video.current;
    if (!v || !v.videoWidth || !v.videoHeight) {
      setMessage("画面还没准备好，请稍等再拍摄。");
      return;
    }
    const scale = Math.min(1, 1024 / Math.max(v.videoWidth, v.videoHeight)),
      canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL("image/jpeg", 0.85));
    setPassed(null);
    setMessage("");
    stop();
  }
  async function recognize() {
    if (!item || !photo) return;
    setBusy(true);
    setMessage("");
    setPassed(null);
    abort.current = new AbortController();
    const timer = setTimeout(() => abort.current?.abort(), 60000);
    try {
      await retry();
      const result = await api.scan(
        tripId,
        itemId,
        photo,
        abort.current.signal,
      );
      if (!alive.current) return;
      setMessage(result.message);
      if (result.matched && result.verification) setPassed(result.verification);
    } catch (e) {
      if (alive.current)
        setMessage(
          (e as Error).name === "AbortError"
            ? "识别超时，请重试。物品保持未确认。"
            : (e as Error).message,
        );
    } finally {
      clearTimeout(timer);
      if (alive.current) setBusy(false);
    }
  }
  if (!item || trip?.status !== "planned")
    return (
      <Modal title="这件物品已改变" onClose={onClose}>
        <p>请返回清单后重新打开扫描。</p>
      </Modal>
    );
  return (
    <Modal
      title={`扫描确认 · ${item.name}`}
      subtitle="Scan, recognize, then pack"
      onClose={onClose}
      footer={
        <div className="scan-actions">
          {photo ? (
            <>
              <Button variant="secondary" disabled={busy} onClick={openCamera}>
                重新拍摄
              </Button>
              {passed ? (
                <Button
                  icon="check"
                  onClick={() => {
                    if (Date.parse(passed.at) < Date.now() - 300000) {
                      setPassed(null);
                      setMessage("核对结果已过期，请重新识别。");
                      return;
                    }
                    try {
                      confirmScannedItem(tripId, itemId, passed);
                      notify(`已扫描确认：${item.name}`);
                      onClose();
                    } catch (e) {
                      setMessage((e as Error).message);
                    }
                  }}
                >
                  放入包中并确认
                </Button>
              ) : (
                <Button
                  icon={busy ? "loader" : "sparkles"}
                  disabled={busy}
                  onClick={recognize}
                >
                  {busy ? "正在识别…" : "识别这张照片"}
                </Button>
              )}
            </>
          ) : streaming ? (
            <Button icon="camera" onClick={capture}>
              拍摄物品
            </Button>
          ) : (
            <Button icon="camera" disabled={cameraBusy} onClick={openCamera}>
              {cameraBusy ? "正在打开…" : "打开相机"}
            </Button>
          )}
        </div>
      }
    >
      <div className="scan-hero">
        <h3>
          确认这一件，
          <br />
          出发更安心。
        </h3>
        <small className="title-english">Keep your essentials close</small>
        <p>把「{item.name}」单独放在画面中央</p>
      </div>
      <div className="camera-stage">
        <video
          ref={video}
          muted
          playsInline
          autoPlay
          style={{ display: streaming ? "block" : "none" }}
        />
        {photo && (
          <img src={photo} alt={`刚拍摄的${item.name}，等待外观核对`} />
        )}
        {!streaming && !photo && (
          <div className="camera-placeholder">
            <Icon name="camera" />
            <p>
              先打开相机，再拍摄这件物品。
              <br />
              识别通过后才可以确认携带。
            </p>
          </div>
        )}
        {(streaming || photo) && <div className="scan-guide" />}
        <div className="camera-caption">
          {streaming
            ? "保持光线充足，尽量拍清完整物品"
            : photo
              ? "本次拍摄 · 不会自动保存照片"
              : "仅使用相机拍摄 · 不从相册导入"}
        </div>
      </div>
      {(busy || message) && (
        <div
          className={`scan-status ${busy ? "busy" : passed ? "success" : "error"}`}
          role="status"
        >
          <strong>
            <Icon
              name={busy ? "loader" : passed ? "success" : "alert"}
              size={16}
            />
            {busy ? "正在核对物品外观…" : passed ? "识别通过" : "暂未确认"}
          </strong>
          {busy ? "首次加载本地识别模型可能稍慢，请保持页面打开。" : message}
        </div>
      )}
      <p className="scan-consent">
        {visionMode === "vision-api"
          ? "点击识别会将本次照片经账号服务发送给已配置的视觉服务商核对；Oopsie 不保存原图。"
          : visionMode === "local-clip"
            ? "点击识别会将本次照片发送到当前账号服务，在服务内核对、不保存原图。"
            : "点击识别会将本次照片发送到当前账号服务；如已配置外部视觉服务，照片会转交该服务核对。Oopsie 不保存原图。"}
        只核对外观类别，不能验证证件内容、文件版本或物品是否已放入包中。关闭页面不会划掉物品。
      </p>
    </Modal>
  );
}
