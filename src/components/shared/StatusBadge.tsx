import { cn } from "@/lib/utils";

type Status = "success" | "error" | "timeout" | "running" | "warning";

const STATUS_STYLES: Record<Status, string> = {
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  error: "bg-red-500/10 text-red-400 border-red-500/20",
  timeout: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  running: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  warning: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

const STATUS_LABELS: Record<Status, string> = {
  success: "成功",
  error: "失败",
  timeout: "超时",
  running: "进行中",
  warning: "警告",
};

const STATUS_ICONS: Record<Status, string> = {
  success: "✅",
  error: "❌",
  timeout: "⏳",
  running: "⏳",
  warning: "⚠️",
};

export default function StatusBadge({ status }: { status: string }) {
  const s = (status as Status) || "error";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
        STATUS_STYLES[s] || STATUS_STYLES.error
      )}
    >
      {STATUS_ICONS[s]} {STATUS_LABELS[s] || status}
    </span>
  );
}
