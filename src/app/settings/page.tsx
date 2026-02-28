"use client";

import { useEffect, useState, useCallback } from "react";
import { Save, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface Config {
  [key: string]: string | number;
}

function TestButton({
  service,
  label,
}: {
  service: string;
  label: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const test = async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service }),
      });
      const data = await res.json();
      setStatus(data.ok ? "success" : "error");
      setMessage(data.message);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Failed");
    }
    setTimeout(() => setStatus("idle"), 3000);
  };

  return (
    <button
      onClick={test}
      disabled={status === "loading"}
      className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-50"
    >
      {status === "loading" && <Loader2 className="h-3 w-3 animate-spin" />}
      {status === "success" && <CheckCircle className="h-3 w-3 text-emerald-400" />}
      {status === "error" && <XCircle className="h-3 w-3 text-red-400" />}
      {status === "idle" ? label : message || label}
    </button>
  );
}

function PasswordField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="px-2 py-2 text-xs border border-border rounded-md hover:bg-accent"
      >
        {visible ? "🙈" : "👁"}
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [config, setConfig] = useState<Config>({});
  const [dirty, setDirty] = useState<Config>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(console.error);
  }, []);

  const update = useCallback((key: string, value: string | number) => {
    setDirty((prev) => ({ ...prev, [key]: value }));
  }, []);

  const getValue = (key: string) => {
    if (key in dirty) return dirty[key];
    return config[key] ?? "";
  };

  const save = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dirty),
      });
      if (res.ok) {
        setConfig((prev) => ({ ...prev, ...dirty }));
        setDirty({});
        setSaveMsg("保存成功");
      } else {
        setSaveMsg("保存失败");
      }
    } catch {
      setSaveMsg("保存失败");
    }
    setSaving(false);
    setTimeout(() => setSaveMsg(""), 3000);
  };

  const hasDirty = Object.keys(dirty).length > 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">配置中心</h1>
        <p className="text-sm text-muted-foreground mt-1">所有配置修改后立即生效，无需重启</p>
      </div>

      {/* LLM Provider */}
      <section className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">🤖 LLM Provider</h2>
          <TestButton service="llm" label="Test Connection" />
        </div>

        <div className="grid gap-3">
          <label className="block">
            <span className="text-xs text-muted-foreground">Provider</span>
            <select
              value={String(getValue("llm_provider"))}
              onChange={(e) => update("llm_provider", e.target.value)}
              className="mt-1 w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="deepseek">DeepSeek</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-muted-foreground">API Key</span>
            <div className="mt-1">
              <PasswordField
                value={String(getValue("llm_api_key"))}
                onChange={(v) => update("llm_api_key", v)}
                placeholder="sk-..."
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs text-muted-foreground">Model</span>
            <select
              value={String(getValue("llm_model"))}
              onChange={(e) => update("llm_model", e.target.value)}
              className="mt-1 w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <optgroup label="Anthropic">
                <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
              </optgroup>
              <optgroup label="OpenAI">
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="gpt-4o">GPT-4o</option>
              </optgroup>
              <optgroup label="DeepSeek">
                <option value="deepseek-chat">DeepSeek Chat</option>
              </optgroup>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-muted-foreground">Max Tokens</span>
              <input
                type="number"
                value={Number(getValue("llm_max_tokens")) || 1024}
                onChange={(e) => update("llm_max_tokens", Number(e.target.value))}
                className="mt-1 w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Temperature</span>
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={Number(getValue("llm_temperature")) || 0.3}
                onChange={(e) => update("llm_temperature", Number(e.target.value))}
                className="mt-1 w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
          </div>
        </div>
      </section>

      {/* OpenTwitter MCP */}
      <section className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">🐦 OpenTwitter MCP</h2>
          <TestButton service="opentwitter" label="Test Connection" />
        </div>
        <div className="grid gap-3">
          <label className="block">
            <span className="text-xs text-muted-foreground">Endpoint</span>
            <input
              type="text"
              value={String(getValue("opentwitter_endpoint"))}
              onChange={(e) => update("opentwitter_endpoint", e.target.value)}
              className="mt-1 w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">API Key</span>
            <div className="mt-1">
              <PasswordField
                value={String(getValue("opentwitter_api_key"))}
                onChange={(v) => update("opentwitter_api_key", v)}
              />
            </div>
          </label>
        </div>
      </section>

      {/* OpenNews MCP */}
      <section className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">📰 OpenNews MCP</h2>
          <TestButton service="opennews" label="Test Connection" />
        </div>
        <div className="grid gap-3">
          <label className="block">
            <span className="text-xs text-muted-foreground">Endpoint</span>
            <input
              type="text"
              value={String(getValue("opennews_endpoint"))}
              onChange={(e) => update("opennews_endpoint", e.target.value)}
              className="mt-1 w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">API Key</span>
            <div className="mt-1">
              <PasswordField
                value={String(getValue("opennews_api_key"))}
                onChange={(v) => update("opennews_api_key", v)}
              />
            </div>
          </label>
        </div>
      </section>

      {/* Lark */}
      <section className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">📨 飞书推送</h2>
          <TestButton service="lark" label="Send Test Message" />
        </div>
        <label className="block">
          <span className="text-xs text-muted-foreground">Webhook URL</span>
          <div className="mt-1">
            <PasswordField
              value={String(getValue("lark_webhook_url"))}
              onChange={(v) => update("lark_webhook_url", v)}
              placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
            />
          </div>
        </label>
      </section>

      {/* GPT Actions */}
      <section className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-medium">🤖 GPT Actions</h2>
        <p className="text-xs text-muted-foreground">
          让 ChatGPT 自定义 GPTs 通过 Actions 调用 PulseFeed API。在 GPT Builder 里导入 OpenAPI Schema URL 即可。
        </p>
        <div className="grid gap-3">
          <label className="block">
            <span className="text-xs text-muted-foreground">GPT API Key（填入 GPT Builder 的 Authentication）</span>
            <div className="mt-1">
              <PasswordField
                value={String(getValue("gpt_api_key"))}
                onChange={(v) => update("gpt_api_key", v)}
                placeholder="自定义一个 API Key，然后填入 GPT Builder"
              />
            </div>
          </label>
          <div className="bg-secondary/50 rounded-md p-3 space-y-2">
            <p className="text-xs text-muted-foreground">📋 GPT Builder 配置步骤：</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>打开 GPT Builder → Actions → Create new action</li>
              <li>Import from URL → 输入: <code className="bg-secondary px-1 rounded text-foreground">https://你的域名/api/gpt/openapi.json</code></li>
              <li>Authentication → API Key → Bearer → 填入上面设置的 Key</li>
              <li>保存，完成！</li>
            </ol>
          </div>
          <button
            onClick={() => {
              const url = `${window.location.origin}/api/gpt/openapi.json`;
              navigator.clipboard.writeText(url);
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-xs border border-border rounded-md hover:bg-accent transition-colors w-fit"
          >
            📋 复制 OpenAPI Schema URL
          </button>
        </div>
      </section>

      {/* AI Thresholds */}
      <section className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-medium">🎯 AI 过滤设置</h2>
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="text-xs text-muted-foreground">相关性阈值</span>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={Number(getValue("relevance_threshold")) || 0.7}
              onChange={(e) => update("relevance_threshold", Number(e.target.value))}
              className="mt-1 w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">重要性阈值</span>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={Number(getValue("importance_threshold")) || 0.5}
              onChange={(e) => update("importance_threshold", Number(e.target.value))}
              className="mt-1 w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">去重窗口 (小时)</span>
            <input
              type="number"
              min="1"
              max="168"
              value={Number(getValue("dedup_window_hours")) || 24}
              onChange={(e) => update("dedup_window_hours", Number(e.target.value))}
              className="mt-1 w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
        </div>
      </section>

      {/* Save button */}
      <div className="sticky bottom-6 flex items-center gap-3">
        <button
          onClick={save}
          disabled={!hasDirty || saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          保存所有配置
        </button>
        {saveMsg && <span className="text-sm text-emerald-400">{saveMsg}</span>}
        {hasDirty && !saveMsg && (
          <span className="text-xs text-muted-foreground">
            {Object.keys(dirty).length} 项待保存
          </span>
        )}
      </div>
    </div>
  );
}
