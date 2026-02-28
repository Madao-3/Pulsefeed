"use client";

import { useEffect, useState, useCallback } from "react";
import StatusBadge from "@/components/shared/StatusBadge";
import { formatRelativeTime } from "@/lib/utils";
import { RefreshCw, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface PushLog {
  id: number;
  channel: string;
  status: string;
  summary: string | null;
  message_body: string;
  error_message: string | null;
  created_at: string;
  source: string | null;
  tool_name: string | null;
  raw_data: string | null;
  duration_ms: number | null;
  target: string | null;
  type: string | null;
  tags: string | null;
}

function LogRow({ log, onRetry }: { log: PushLog; onRetry: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const emoji = log.source === "opentwitter" ? "🐦" : "📰";

  return (
    <div className="border-b border-border last:border-0">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span>{emoji}</span>
        <span className="text-sm font-medium flex-1 truncate">{log.target || log.summary || "—"}</span>
        <StatusBadge status={log.status} />
        <span className="text-xs text-muted-foreground">{formatRelativeTime(log.created_at)}</span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </div>
      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {log.summary && (
            <div className="text-sm bg-secondary/50 rounded p-3">
              <span className="text-xs text-muted-foreground block mb-1">AI 摘要</span>
              {log.summary}
            </div>
          )}
          {log.error_message && (
            <div className="text-sm bg-red-500/10 text-red-400 rounded p-3">{log.error_message}</div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              来源: {log.source || "—"} | 耗时: {log.duration_ms ? `${log.duration_ms}ms` : "—"}
            </span>
            {log.status === "error" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry(log.id);
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs border border-border rounded hover:bg-accent"
              >
                <RefreshCw className="h-3 w-3" /> 重推
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<PushLog[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [retrying, setRetrying] = useState<number | null>(null);
  const limit = 20;

  const load = useCallback(() => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    if (sourceFilter) params.set("source", sourceFilter);
    if (statusFilter) params.set("status", statusFilter);

    fetch(`/api/history?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      })
      .catch(console.error);
  }, [offset, sourceFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const retry = async (id: number) => {
    setRetrying(id);
    try {
      await fetch(`/api/push/retry/${id}`, { method: "POST" });
      load();
    } catch {
      // ignore
    }
    setRetrying(null);
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">推送历史</h1>
        <p className="text-sm text-muted-foreground mt-1">所有飞书推送记录</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); setOffset(0); }}
          className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">全部来源</option>
          <option value="opentwitter">Twitter</option>
          <option value="opennews">News</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
          className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">全部状态</option>
          <option value="success">成功</option>
          <option value="error">失败</option>
        </select>
        <span className="text-xs text-muted-foreground self-center ml-auto">
          共 {total} 条记录
        </span>
      </div>

      {/* Log list */}
      <div className="bg-card border border-border rounded-lg">
        {logs.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">暂无推送记录</div>
        ) : (
          logs.map((log) => (
            <LogRow
              key={log.id}
              log={log}
              onRetry={(id) => {
                if (retrying) return;
                retry(id);
              }}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={currentPage <= 1}
            onClick={() => setOffset(Math.max(0, offset - limit))}
            className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent disabled:opacity-50"
          >
            上一页
          </button>
          <span className="text-sm text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => setOffset(offset + limit)}
            className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
