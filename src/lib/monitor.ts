import os from "os";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

export interface SystemMetrics {
  cpu: {
    usage: number; // percentage 0-100
    cores: number;
  };
  memory: {
    used: number; // bytes
    total: number; // bytes
    percentage: number;
    processRss: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
    dbSize: number;
  };
  uptime: number; // ms
}

let lastCpuInfo: { idle: number; total: number } | null = null;

function getCpuUsage(): number {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
  }

  if (!lastCpuInfo) {
    lastCpuInfo = { idle, total };
    return 0;
  }

  const idleDiff = idle - lastCpuInfo.idle;
  const totalDiff = total - lastCpuInfo.total;
  lastCpuInfo = { idle, total };

  if (totalDiff === 0) return 0;
  return Math.round((1 - idleDiff / totalDiff) * 100);
}

function getDiskInfo(): { used: number; total: number; percentage: number } {
  try {
    const output = execSync("df -k /", { encoding: "utf8" });
    const lines = output.trim().split("\n");
    if (lines.length < 2) return { used: 0, total: 0, percentage: 0 };
    const parts = lines[1].split(/\s+/);
    const total = parseInt(parts[1]) * 1024;
    const used = parseInt(parts[2]) * 1024;
    return { used, total, percentage: Math.round((used / total) * 100) };
  } catch {
    return { used: 0, total: 0, percentage: 0 };
  }
}

function getDbSize(): number {
  const dbPath = path.join(process.cwd(), "data", "pulsefeed.db");
  try {
    const stat = fs.statSync(dbPath);
    return stat.size;
  } catch {
    return 0;
  }
}

export function getSystemMetrics(): SystemMetrics {
  const mem = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const disk = getDiskInfo();

  return {
    cpu: {
      usage: getCpuUsage(),
      cores: os.cpus().length,
    },
    memory: {
      used: usedMem,
      total: totalMem,
      percentage: Math.round((usedMem / totalMem) * 100),
      processRss: mem.rss,
    },
    disk: {
      ...disk,
      dbSize: getDbSize(),
    },
    uptime: process.uptime() * 1000,
  };
}

export type AlertLevel = "warning" | "danger" | "info";

export interface Alert {
  id: string;
  level: AlertLevel;
  message: string;
  timestamp: string;
}

export function getAlerts(): Alert[] {
  const metrics = getSystemMetrics();
  const alerts: Alert[] = [];
  const now = new Date().toISOString();

  if (metrics.memory.percentage > 90) {
    alerts.push({
      id: "mem-danger",
      level: "danger",
      message: `内存使用率 ${metrics.memory.percentage}% — 超过 90% 危险阈值`,
      timestamp: now,
    });
  } else if (metrics.memory.percentage > 80) {
    alerts.push({
      id: "mem-warning",
      level: "warning",
      message: `内存使用率 ${metrics.memory.percentage}% — 超过 80% 警告阈值`,
      timestamp: now,
    });
  }

  if (metrics.disk.percentage > 90) {
    alerts.push({
      id: "disk-danger",
      level: "danger",
      message: `磁盘使用率 ${metrics.disk.percentage}%`,
      timestamp: now,
    });
  }

  return alerts;
}
