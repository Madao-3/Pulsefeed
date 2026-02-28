"use client";

import { useEffect, useState } from "react";
import StatusBadge from "@/components/shared/StatusBadge";
import { formatRelativeTime } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

interface LogEntry {
  id: number;
  source: string;
  tool_name: string;
  status: string;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
  target: string | null;
  type: string | null;
  push_status: string | null;
  summary: string | null;
}

function LogItem({ log }: { log: LogEntry }) {
  const [expanded, setExpanded] = useState(false);

  const sourceEmoji = log.source === "opentwitter" ? "🐦" : "📰";
  const target = log.target || log.tool_name;

  return (
    <div className="border-b border-border last:border-0">
      <div
        className="flex items-center gap-3 py-3 px-4 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-sm">{sourceEmoji}</span>
        <span className="text-sm font-medium flex-1 truncate">{target}</span>
        <StatusBadge status={log.status} />
        {log.duration_ms && (
          <span className="text-xs text-muted-foreground">{log.duration_ms}ms</span>
        )}
        <span className="text-xs text-muted-foreground">{formatRelativeTime(log.created_at)}</span>
        {expanded ? (
          <ChevronUp className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        )}
      </div>
      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {log.summary && (
            <div className="text-sm bg-secondary/50 rounded p-2">
              <span className="text-xs text-muted-foreground block mb-1">AI 摘要</span>
              {log.summary}
            </div>
          )}
          {log.error_message && (
            <div className="text-sm bg-red-500/10 text-red-400 rounded p-2">
              {log.error_message}
            </div>
          )}
          {log.push_status && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">推送:</span>
              <StatusBadge status={log.push_status} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ActivityFeed() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const load = () => {
      fetch("/api/stats/logs?limit=20")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setLogs(data);
        })
        .catch(console.error);
    };
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-medium">最近活动</h3>
      </div>
      {logs.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          暂无活动记录，配置关注列表后将自动开始抓取
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto">{logs.map((log) => <LogItem key={log.id} log={log} />)}</div>
      )}
    </div>
  );
}
