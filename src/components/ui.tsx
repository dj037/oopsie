import {
  useEffect,
  useRef,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import {
  Camera,
  AlarmClock,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  Plus,
  X,
  Check,
  ChevronRight,
  ChevronDown,
  CalendarDays,
  Clock,
  MapPin,
  Bell,
  Settings,
  LogOut,
  Mail,
  LockKeyhole,
  User,
  Eye,
  EyeOff,
  Sparkles,
  BriefcaseBusiness,
  Presentation,
  GraduationCap,
  Dumbbell,
  Luggage,
  Users,
  House,
  Route,
  Backpack,
  CheckCheck,
  AlertCircle,
  Trash2,
  Pencil,
  Copy,
  Navigation,
  RotateCcw,
  Volume2,
  ShieldCheck,
  Search,
  MoreHorizontal,
  LoaderCircle,
  WifiOff,
  RefreshCw,
  Footprints,
  TrainFront,
  Car,
  Menu,
  Heart,
  Sun,
  CheckCircle2,
  Info,
  ExternalLink,
  SlidersHorizontal,
  Minus,
} from "lucide-react";
const icons = {
  camera: Camera,
  alarm: AlarmClock,
  shop: ShoppingBag,
  arrow: ArrowRight,
  back: ArrowLeft,
  plus: Plus,
  x: X,
  check: Check,
  chevron: ChevronRight,
  down: ChevronDown,
  calendar: CalendarDays,
  clock: Clock,
  pin: MapPin,
  bell: Bell,
  settings: Settings,
  logout: LogOut,
  mail: Mail,
  lock: LockKeyhole,
  user: User,
  eye: Eye,
  eyeOff: EyeOff,
  sparkles: Sparkles,
  briefcase: BriefcaseBusiness,
  presentation: Presentation,
  graduation: GraduationCap,
  dumbbell: Dumbbell,
  luggage: Luggage,
  users: Users,
  home: House,
  route: Route,
  backpack: Backpack,
  checks: CheckCheck,
  alert: AlertCircle,
  trash: Trash2,
  edit: Pencil,
  copy: Copy,
  navigation: Navigation,
  undo: RotateCcw,
  volume: Volume2,
  shield: ShieldCheck,
  search: Search,
  more: MoreHorizontal,
  loader: LoaderCircle,
  offline: WifiOff,
  refresh: RefreshCw,
  walk: Footprints,
  train: TrainFront,
  car: Car,
  menu: Menu,
  heart: Heart,
  sun: Sun,
  success: CheckCircle2,
  info: Info,
  external: ExternalLink,
  sliders: SlidersHorizontal,
  minus: Minus,
  cloud: CheckCircle2,
};
export type IconName = keyof typeof icons;
export function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const Component = icons[name];
  return (
    <Component
      size={size}
      strokeWidth={1.7}
      className={className}
      aria-hidden="true"
    />
  );
}
export function Button({
  children,
  variant = "primary",
  icon,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: IconName;
}) {
  return (
    <button
      type="button"
      className={`button ${variant} ${className}`}
      {...props}
    >
      {icon && <Icon name={icon} size={18} />}
      <span>{children}</span>
    </button>
  );
}
export function IconButton({
  name,
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  name: IconName;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="icon-button"
      {...props}
    >
      <Icon name={name} />
    </button>
  );
}
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`logo ${small ? "small" : ""}`}>
      <div className="logo-mark">
        <img src="/assets/mascot.png" alt="" />
      </div>
      <span>
        oopsie<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
export function PageTitle({
  title,
  english,
}: {
  title: string;
  english: string;
}) {
  return (
    <div className="page-title">
      <h1>{title}</h1>
      <p>{english}</p>
    </div>
  );
}
export function Avatar({
  name,
  src,
  className = "",
}: {
  name: string;
  src?: string;
  className?: string;
}) {
  return (
    <span className={`user-avatar ${className}`}>
      {src ? <img src={src} alt={`${name}的头像`} /> : name.slice(0, 1)}
    </span>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "orange" | "green" | "neutral" | "red";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({
  title,
  description,
  children,
  icon = "backpack",
}: {
  title: string;
  description: string;
  children?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={30} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Modal({
  title,
  eyebrow,
  subtitle = "Oopsie · Ready to go",
  children,
  onClose,
  wide = false,
  footer,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
      }
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-header">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h2 id="modal-title">{title}</h2>
            <p className="title-english">{subtitle}</p>
          </div>
          <IconButton name="x" label="关闭" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
export function Confirm({
  title,
  description,
  confirmText = "确认",
  onConfirm,
  onClose,
  danger = false,
}: {
  title: string;
  description: ReactNode;
  confirmText?: string;
  onConfirm: () => void;
  onClose: () => void;
  danger?: boolean;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            返回
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="confirm-copy">{description}</div>
    </Modal>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="toggle-row">
      <div>
        <strong>{label}</strong>
        {description && <p>{description}</p>}
      </div>
      <button
        type="button"
        className={`toggle ${checked ? "on" : ""}`}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}
export const timeText = (value: number | string | null | undefined) =>
  value === null || value === undefined
    ? "待定"
    : new Date(value).toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
export const dateText = (value: number | string | null | undefined) =>
  value === null || value === undefined
    ? "时间待定"
    : new Date(value).toLocaleDateString("zh-CN", {
        month: "long",
        day: "numeric",
        weekday: "short",
      });
export function toInputDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}
export function dayKey(iso: string | null) {
  return iso ? toInputDate(iso).slice(0, 10) : "";
}
