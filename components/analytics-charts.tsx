"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const RATING_COLORS: Record<string, string> = {
  Outstanding: "#22C55E",
  Good: "#10B981",
  "Requires improvement": "#F59E0B",
  Inadequate: "#DC2626",
  "Not rated": "#9CA3AF",
};

export function AnalyticsCharts({
  leadTrend,
  activityTrend,
  funnel,
  bySource,
  byRegion,
  byType,
  byRating,
  activityByType,
}: {
  leadTrend: { week: string; count: number }[];
  activityTrend: { week: string; count: number }[];
  funnel: { name: string; count: number; color: string }[];
  bySource: { name: string; count: number }[];
  byRegion: { name: string; count: number }[];
  byType: { name: string; count: number }[];
  byRating: { name: string; count: number }[];
  activityByType: { name: string; count: number }[];
}) {
  // Merge the two trend series on week
  const weeks = [...new Set([...leadTrend.map((t) => t.week), ...activityTrend.map((t) => t.week)])].sort();
  const trend = weeks.map((w) => ({
    week: w.slice(5),
    leads: leadTrend.find((t) => t.week === w)?.count || 0,
    touches: activityTrend.find((t) => t.week === w)?.count || 0,
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Acquisition &amp; Outreach — last 90 days</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="leads"
                name="New leads"
                stroke="#0A0A0A"
                fill="#0A0A0A"
                fillOpacity={0.15}
              />
              <Area
                type="monotone"
                dataKey="touches"
                name="Outreach touches"
                stroke="#DC2626"
                fill="#DC2626"
                fillOpacity={0.15}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pipeline by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={funnel} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {funnel.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">CQC Ratings of Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={byRating}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {byRating.map((r) => (
                    <Cell key={r.name} fill={RATING_COLORS[r.name] || "#6B7280"} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leads by Region</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byRegion} margin={{ bottom: 60 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#DC2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Outreach by Channel</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={activityByType}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#0A0A0A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
