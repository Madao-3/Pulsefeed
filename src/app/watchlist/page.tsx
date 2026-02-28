"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Play, Loader2 } from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";

interface WatchlistItem {
  id: number;
  type: string;
  target: string;
  tags: string;
  interval_ms: number;
  enabled: number;
  config: string;
  created_at: string;
  updated_at: string;
}

const INTERVAL_OPTIONS = [
  { label: "5 分钟", value: 300_000 },
  { label: "15 分钟", value: 900_000 },
  { label: "30 分钟", value: 1_800_000 },
  { label: "1 小时", value: 3_600_000 },
  { label: "2 小时", value: 7_200_000 },
];

function AddItemDialog({
  type,
  onAdd,
  onClose,
}: {
  type: "twitter_kol" | "news_keyword";
  onAdd: (item: Partial<WatchlistItem>) => void;
  onClose: () => void;
}) {
  const [target, setTarget] = useState("");
  const [tags, setTags] = useState("");
  const [interval, setInterval] = useState(900_000);

  const submit = () => {
    if (!target.trim()) return;
    onAdd({
      type,
      target: target.trim().replace(/^@/, ""),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean) as unknown as string,
      interval_ms: interval,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg p-5 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-medium">
          {type === "twitter_kol" ? "添加 Twitter KOL" : "添加新闻关键词"}
        </h3>
        <label className="block">
          <span className="text-xs text-muted-foreground">
            {type === "twitter_kol" ? "Twitter Handle" : "关键词"}
          </span>
          <input
            autoFocus
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={type === "twitter_kol" ? "@VitalikButerin" : "gold tokenization"}
            className="mt-1 w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">标签（逗号分隔）</span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Gold, RWA, DeFi"
            className="mt-1 w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">轮询间隔</span>
          <select
            value={interval}
            onChange={(e) => setInterval(Number(e.target.value))}
            className="mt-1 w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent">
            取消
          </button>
          <button
            onClick={submit}
            disabled={!target.trim()}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            添加
          </button>
        </div>
      </div>
    </div>
  );
}

function intervalLabel(ms: number): string {
  const opt = INTERVAL_OPTIONS.find((o) => o.value === ms);
  return opt?.label || `${ms / 60_000}min`;
}

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [addType, setAddType] = useState<"twitter_kol" | "news_keyword" | null>(null);
  const [triggeringId, setTriggeringId] = useState<number | null>(null);

  const load = useCallback(() => {
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setItems(data);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addItem = async (item: Partial<WatchlistItem>) => {
    await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    load();
  };

  const deleteItem = async (id: number) => {
    await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
    load();
  };

  const toggleItem = async (id: number) => {
    await fetch(`/api/watchlist/${id}/toggle`, { method: "PUT" });
    load();
  };

  const triggerFetch = async (id: number) => {
    setTriggeringId(id);
    try {
      await fetch("/api/fetch/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watchlist_id: id }),
      });
    } catch {
      // ignore
    }
    setTriggeringId(null);
  };

  const kols = items.filter((i) => i.type === "twitter_kol");
  const keywords = items.filter((i) => i.type === "news_keyword");

  function parseTags(tags: string): string[] {
    try {
      const parsed = JSON.parse(tags);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">关注列表</h1>
        <p className="text-sm text-muted-foreground mt-1">管理 Twitter KOL 和新闻关键词监控</p>
      </div>

      {/* Twitter KOLs */}
      <section className="bg-card border border-border rounded-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-medium">🐦 Twitter KOL</h2>
          <button
            onClick={() => setAddType("twitter_kol")}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <Plus className="h-3 w-3" /> 添加
          </button>
        </div>
        {kols.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            暂无 KOL，点击"添加"开始监控
          </div>
        ) : (
          <div className="divide-y divide-border">
            {kols.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => toggleItem(item.id)}
                  className={`flex-shrink-0 w-9 h-5 rounded-full transition-colors relative ${
                    item.enabled ? "bg-primary" : "bg-secondary"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      item.enabled ? "left-4" : "left-0.5"
                    }`}
                  />
                </button>
                <span className="font-mono text-sm font-medium min-w-0 truncate">@{item.target}</span>
                <div className="flex gap-1 flex-shrink-0">
                  {parseTags(item.tags).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-secondary text-xs rounded-full whitespace-nowrap">{tag}</span>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">{intervalLabel(item.interval_ms)}</span>
                <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                  <button
                    onClick={() => triggerFetch(item.id)}
                    disabled={triggeringId === item.id}
                    className="p-1.5 hover:bg-accent rounded-md transition-colors"
                    title="手动触发抓取"
                  >
                    {triggeringId === item.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-1.5 hover:bg-red-500/10 text-red-400 rounded-md transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* News Keywords */}
      <section className="bg-card border border-border rounded-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-medium">📰 新闻关键词</h2>
          <button
            onClick={() => setAddType("news_keyword")}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <Plus className="h-3 w-3" /> 添加
          </button>
        </div>
        {keywords.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            暂无关键词，点击"添加"开始监控
          </div>
        ) : (
          <div className="divide-y divide-border">
            {keywords.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => toggleItem(item.id)}
                  className={`flex-shrink-0 w-9 h-5 rounded-full transition-colors relative ${
                    item.enabled ? "bg-primary" : "bg-secondary"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      item.enabled ? "left-4" : "left-0.5"
                    }`}
                  />
                </button>
                <span className="text-sm font-medium min-w-0 truncate">{item.target}</span>
                <div className="flex gap-1 flex-shrink-0">
                  {parseTags(item.tags).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-secondary text-xs rounded-full whitespace-nowrap">{tag}</span>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">{intervalLabel(item.interval_ms)}</span>
                <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                  <button
                    onClick={() => triggerFetch(item.id)}
                    disabled={triggeringId === item.id}
                    className="p-1.5 hover:bg-accent rounded-md transition-colors"
                    title="手动触发抓取"
                  >
                    {triggeringId === item.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-1.5 hover:bg-red-500/10 text-red-400 rounded-md transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add Dialog */}
      {addType && <AddItemDialog type={addType} onAdd={addItem} onClose={() => setAddType(null)} />}
    </div>
  );
}
