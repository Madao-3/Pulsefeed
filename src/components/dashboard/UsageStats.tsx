"use client";

import { useEffect, useState } from "react";
import { Twitter, Newspaper, Bot, Send } from "lucide-react";

interface UsageData {
  mcp: Array<{ source: string; tool_name: string; status: string; count: number }>;
  llm: Array<{
    provider: string;
    model: string;
    total_tokens: number;
    total_cost: number;
    call_count: number;
  }>;
  push: Array<{ status: string; count: number }>;
  today: { mcp: Array<{ source: string; count: number }>; llm_tokens: number; llm_cost: number };
}

function StatCard({
  icon: Icon,
  title,
  value,
  subtitle,
  color,
}: {
  icon: React.ElementType;
  title: string;
  value: string | number;
  subtitle: string;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4" style={{ color }} />
        <span className="text-sm text-muted-foreground">{title}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}

export default function UsageStats() {
  const [data, setData] = useState<UsageData | null>(null);

  useEffect(() => {
    fetch("/api/stats/usage")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  if (!data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-4 h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  const twitterCalls = data.mcp
    .filter((m) => m.source === "opentwitter")
    .reduce((s, m) => s + m.count, 0);
  const newsCalls = data.mcp
    .filter((m) => m.source === "opennews")
    .reduce((s, m) => s + m.count, 0);
  const totalTokens = data.llm.reduce((s, l) => s + l.total_tokens, 0);
  const totalCost = data.llm.reduce((s, l) => s + l.total_cost, 0);
  const pushSuccess = data.push.find((p) => p.status === "success")?.count || 0;
  const pushError = data.push.find((p) => p.status === "error")?.count || 0;

  const todayTwitter = data.today.mcp.find((m) => m.source === "opentwitter")?.count || 0;
  const todayNews = data.today.mcp.find((m) => m.source === "opennews")?.count || 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={Twitter}
        title="Twitter MCP"
        value={twitterCalls}
        subtitle={`今日 ${todayTwitter} 次`}
        color="#1d9bf0"
      />
      <StatCard
        icon={Newspaper}
        title="News MCP"
        value={newsCalls}
        subtitle={`今日 ${todayNews} 次`}
        color="#22c55e"
      />
      <StatCard
        icon={Bot}
        title="LLM Token"
        value={totalTokens.toLocaleString()}
        subtitle={`预估 $${totalCost.toFixed(4)}`}
        color="#8b5cf6"
      />
      <StatCard
        icon={Send}
        title="飞书推送"
        value={pushSuccess}
        subtitle={pushError > 0 ? `${pushError} 次失败` : "全部成功"}
        color="#f97316"
      />
    </div>
  );
}
