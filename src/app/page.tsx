import SystemMetrics from "@/components/dashboard/SystemMetrics";
import UsageStats from "@/components/dashboard/UsageStats";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import AlertBanner from "@/components/dashboard/AlertBanner";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">小龙虾健康监控 🦞</p>
      </div>

      <AlertBanner />

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">系统资源</h2>
        <SystemMetrics />
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">API 用量统计</h2>
        <UsageStats />
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">最近活动流</h2>
        <ActivityFeed />
      </div>
    </div>
  );
}
