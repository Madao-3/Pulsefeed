"use client";

import { useEffect, useState } from "react";
import { Cpu, HardDrive, Clock, MemoryStick } from "lucide-react";
import { formatBytes, formatDuration } from "@/lib/utils";

interface Metrics {
  cpu: { usage: number; cores: number };
  memory: { used: number; total: number; percentage: number; processRss: number };
  disk: { used: number; total: number; percentage: number; dbSize: number };
  uptime: number;
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }}
      />
    </div>
  );
}

function MetricCard({
  icon: Icon,
  title,
  value,
  subtitle,
  percentage,
  color,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  subtitle: string;
  percentage?: number;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4" style={{ color }} />
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
      </div>
      <p className="text-2xl font-bold mb-1">{value}</p>
      <p className="text-xs text-muted-foreground mb-2">{subtitle}</p>
      {percentage !== undefined && <ProgressBar value={percentage} color={color} />}
    </div>
  );
}

export default function SystemMetrics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    const load = () => {
      fetch("/api/stats/system")
        .then((r) => r.json())
        .then(setMetrics)
        .catch(console.error);
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-4 h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  const memColor =
    metrics.memory.percentage > 90 ? "#ef4444" : metrics.memory.percentage > 80 ? "#eab308" : "#22c55e";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        icon={Cpu}
        title="CPU 使用率"
        value={`${metrics.cpu.usage}%`}
        subtitle={`${metrics.cpu.cores} 核心`}
        percentage={metrics.cpu.usage}
        color="#3b82f6"
      />
      <MetricCard
        icon={MemoryStick}
        title="内存使用"
        value={formatBytes(metrics.memory.used)}
        subtitle={`/ ${formatBytes(metrics.memory.total)} (进程: ${formatBytes(metrics.memory.processRss)})`}
        percentage={metrics.memory.percentage}
        color={memColor}
      />
      <MetricCard
        icon={HardDrive}
        title="磁盘 / DB"
        value={formatBytes(metrics.disk.dbSize)}
        subtitle={`磁盘 ${formatBytes(metrics.disk.used)} / ${formatBytes(metrics.disk.total)}`}
        percentage={metrics.disk.percentage}
        color="#8b5cf6"
      />
      <MetricCard
        icon={Clock}
        title="运行时长"
        value={formatDuration(metrics.uptime)}
        subtitle="since last restart"
        color="#f97316"
      />
    </div>
  );
}
