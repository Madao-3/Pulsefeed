"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  level: "warning" | "danger" | "info";
  message: string;
  timestamp: string;
}

const LEVEL_STYLES = {
  danger: "bg-red-500/10 border-red-500/20 text-red-400",
  warning: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
  info: "bg-blue-500/10 border-blue-500/20 text-blue-400",
};

const LEVEL_ICONS = {
  danger: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export default function AlertBanner() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const load = () => {
      fetch("/api/stats/alerts")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setAlerts(data);
        })
        .catch(console.error);
    };
    load();
    const interval = setInterval(load, 15_000);
    return () => clearInterval(interval);
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const Icon = LEVEL_ICONS[alert.level];
        return (
          <div
            key={alert.id}
            className={cn("flex items-center gap-3 px-4 py-3 rounded-lg border", LEVEL_STYLES[alert.level])}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">{alert.message}</span>
          </div>
        );
      })}
    </div>
  );
}
