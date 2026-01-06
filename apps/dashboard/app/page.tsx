"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart } from "./components/BarChart";
import { DataTable } from "./components/DataTable";
import { LineChart } from "./components/LineChart";
import { StatCard } from "./components/StatCard";
import type { UsageEvent, UsageSummary } from "./lib/types";

type UserOption = {
  id: string;
  name: string | null;
  plan: string | null;
  subscription_period: string | null;
  trial_ends_at: string | null;
};

const formatNumber = (value: number) => value.toLocaleString("en-US");
const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
const formatDate = (value: string) => new Date(value).toLocaleString();

const defaultRange = () => {
  const end = new Date();
  const start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);

  const initialRange = defaultRange();
  const [filters, setFilters] = useState({
    start: initialRange.start,
    end: initialRange.end,
    userId: "",
    eventType: "",
    source: "",
    model: "",
    usageContext: "",
  });

  const activeUser = users.find((user) => user.id === filters.userId);

  const fetchSummary = async () => {
    const params = new URLSearchParams();
    if (filters.start) params.set("start", filters.start);
    if (filters.end) params.set("end", filters.end);
    const response = await fetch(`/api/summary?${params.toString()}`);
    if (!response.ok) return;
    const data = (await response.json()) as UsageSummary;
    setSummary(data);
  };

  const fetchUsers = async () => {
    const response = await fetch("/api/users");
    if (!response.ok) return;
    const data = await response.json();
    setUsers(data.users ?? []);
  };

  const fetchEvents = async () => {
    const params = new URLSearchParams();
    if (filters.userId) params.set("userId", filters.userId);
    if (filters.eventType) params.set("eventType", filters.eventType);
    if (filters.source) params.set("source", filters.source);
    if (filters.model) params.set("model", filters.model);
    if (filters.usageContext) params.set("usageContext", filters.usageContext);
    if (filters.start) params.set("start", filters.start);
    if (filters.end) params.set("end", filters.end);
    params.set("limit", "300");
    const response = await fetch(`/api/events?${params.toString()}`);
    if (!response.ok) return;
    const data = await response.json();
    setEvents(data.events ?? []);
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSummary(), fetchEvents()]).finally(() => setLoading(false));
  }, [filters]);

  const dailySeries = summary?.dailySeries ?? [];
  const chartSeries = useMemo(
    () => [
      {
        name: "Recipe imports",
        color: "#7c3aed",
        data: dailySeries.map((item) => ({ label: item.date, value: item.imports })),
      },
      {
        name: "AI credits used",
        color: "#f97316",
        data: dailySeries.map((item) => ({ label: item.date, value: item.aiCredits })),
      },
    ],
    [dailySeries]
  );

  return (
    <div className="dashboardRoot">
      <header className="dashboardHeader">
        <div>
          <p className="eyebrow">Recepify Admin</p>
          <h1>Usage & Revenue Dashboard</h1>
          <p className="subtitle">
            Track plans, credit usage, AI cost, and power users across all sources.
          </p>
        </div>
        <div className="headerBadge">
          <span>{summary?.totalUsers ?? 0} users</span>
        </div>
      </header>

      <section className="filterBar">
        <div className="filterGroup">
          <label>
            Start
            <input
              type="date"
              value={filters.start}
              onChange={(event) => setFilters((prev) => ({ ...prev, start: event.target.value }))}
            />
          </label>
          <label>
            End
            <input
              type="date"
              value={filters.end}
              onChange={(event) => setFilters((prev) => ({ ...prev, end: event.target.value }))}
            />
          </label>
        </div>

        <div className="filterGroup">
          <label>
            User
            <select
              value={filters.userId}
              onChange={(event) => setFilters((prev) => ({ ...prev, userId: event.target.value }))}
            >
              <option value="">All users</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {(user.name ?? "User").trim() || "User"} · {user.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Action
            <select
              value={filters.eventType}
              onChange={(event) => setFilters((prev) => ({ ...prev, eventType: event.target.value }))}
            >
              <option value="">All actions</option>
              <option value="import">Import</option>
              <option value="scan">Scan</option>
              <option value="ai_assistant">AI assistant</option>
              <option value="ai_finder">AI finder</option>
              <option value="import_credit">Import credit</option>
            </select>
          </label>
          <label>
            Source
            <select
              value={filters.source}
              onChange={(event) => setFilters((prev) => ({ ...prev, source: event.target.value }))}
            >
              <option value="">All sources</option>
              <option value="web">Web</option>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
              <option value="pinterest">Pinterest</option>
              <option value="youtube">YouTube</option>
              <option value="scan">Scan</option>
              <option value="assistant">Assistant</option>
              <option value="finder">Finder</option>
            </select>
          </label>
          <label>
            Usage context
            <select
              value={filters.usageContext}
              onChange={(event) => setFilters((prev) => ({ ...prev, usageContext: event.target.value }))}
            >
              <option value="">All contexts</option>
              <option value="chat">Chat</option>
              <option value="translate_recipe">Translate</option>
              <option value="improve_title">Improve title</option>
              <option value="infer_ingredients">Infer ingredients</option>
              <option value="generate_description">Generate description</option>
              <option value="generate_steps">Generate steps</option>
              <option value="optimize_ingredients">Optimize ingredients</option>
              <option value="calculate_nutrition">Nutrition</option>
              <option value="suggest_tags">Suggest tags</option>
              <option value="estimate_time">Estimate time</option>
            </select>
          </label>
        </div>

        <div className="filterSummary">
          {loading ? "Refreshing..." : activeUser ? `${activeUser.name ?? "User"} selected` : "All users"}
        </div>
      </section>

      <section className="statGrid">
        <StatCard
          label="Active users"
          value={formatNumber(summary?.activeUsers ?? 0)}
          sub="Last 30 days"
          accent="purple"
        />
        <StatCard
          label="Recipe imports"
          value={formatNumber(summary?.totalImports ?? 0)}
          sub="Credits consumed"
          accent="orange"
        />
        <StatCard
          label="AI credits used"
          value={formatNumber(summary?.totalAiCredits ?? 0)}
          sub="Weighted tokens"
          accent="green"
        />
        <StatCard
          label="Estimated cost"
          value={formatCurrency(summary?.totalCostUsd ?? 0)}
          sub="OpenAI + Vision"
          accent="purple"
        />
      </section>

      <section className="planGrid">
        <div className="planCard">
          <h3>Plan mix</h3>
          <div className="planRow">
            <span>Recepify Base</span>
            <strong>{formatNumber(summary?.baseUsers ?? 0)}</strong>
          </div>
          <div className="planRow">
            <span>Recepify Premium</span>
            <strong>{formatNumber(summary?.premiumUsers ?? 0)}</strong>
          </div>
          <div className="planRow">
            <span>Trials active</span>
            <strong>{formatNumber(summary?.trialUsers ?? 0)}</strong>
          </div>
        </div>
        <div className="planCard highlight">
          <h3>Focus list</h3>
          <ul>
            <li>Spot power users by AI credits/day.</li>
            <li>Identify sources with the highest cost per import.</li>
            <li>Track conversion: trial → base → premium.</li>
          </ul>
        </div>
      </section>

      <section className="chartGrid">
        <LineChart title="Daily imports vs AI credits" series={chartSeries} />
        <BarChart
          title="Imports by source"
          data={summary?.bySource ?? []}
          color="#7c3aed"
        />
        <BarChart
          title="AI credits by model"
          data={summary?.byModel ?? []}
          color="#f97316"
        />
      </section>

      <section className="tablesGrid">
        <DataTable
          title="Recent usage events"
          rows={events}
          emptyLabel="No events for this filter."
          columns={[
            {
              key: "time",
              header: "Time",
              render: (row) => formatDate(row.created_at),
            },
            {
              key: "user",
              header: "User",
              render: (row) => row.owner_id.slice(0, 8),
            },
            {
              key: "action",
              header: "Action",
              render: (row) => row.event_type.replaceAll("_", " "),
            },
            {
              key: "source",
              header: "Source",
              render: (row) => row.source ?? "—",
            },
            {
              key: "model",
              header: "Model",
              render: (row) => row.model_name ?? "—",
            },
            {
              key: "credits",
              header: "Credits",
              render: (row) =>
                row.ai_credits_used || row.import_credits_used
                  ? formatNumber((row.ai_credits_used ?? 0) + (row.import_credits_used ?? 0))
                  : "0",
            },
            {
              key: "cost",
              header: "Cost",
              render: (row) => (row.cost_usd ? formatCurrency(row.cost_usd) : "—"),
            },
            {
              key: "context",
              header: "Context",
              render: (row) => {
                if (typeof row.metadata !== "object" || !row.metadata) {
                  return "—";
                }
                const context = (row.metadata as Record<string, unknown>).usage_context;
                return context ? String(context) : "—";
              },
            },
          ]}
        />
      </section>
    </div>
  );
}
