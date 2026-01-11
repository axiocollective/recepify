"use client";

import { useEffect, useRef, useState } from "react";
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
  language?: string | null;
  country?: string | null;
  email?: string | null;
};

const formatNumber = (value: number) => value.toLocaleString("en-US");
const formatCurrency = (value: number) =>
  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (value: string) => new Date(value).toLocaleString();
const formatModelName = (value: string | null | undefined) => {
  const trimmed = value && String(value).trim() ? String(value) : "No model";
  if (trimmed === "document-text-detection") {
    return "Google Vision (text detection)";
  }
  return trimmed;
};
const formatUsageCredits = (row: UsageEvent) => {
  const model = formatModelName(row.model_name);
  if (
    model === "whisper-1" &&
    row.metadata &&
    typeof row.metadata === "object" &&
    (row.metadata as Record<string, unknown>).audio_seconds
  ) {
    const seconds = Number((row.metadata as Record<string, unknown>).audio_seconds || 0);
    return `${Math.round(seconds)}s`;
  }
  if (
    row.model_provider === "google-vision" &&
    row.metadata &&
    typeof row.metadata === "object" &&
    (row.metadata as Record<string, unknown>).images
  ) {
    const images = Number((row.metadata as Record<string, unknown>).images || 0);
    return `${formatNumber(images)} img`;
  }
  if (row.event_type === "import_credit") {
    return `-${formatNumber(row.import_credits_used ?? 0)}`;
  }
  return formatNumber(row.ai_credits_used ?? 0);
};

const formatEventModel = (row: UsageEvent) =>
  row.event_type === "import_credit" ? "import credit" : formatModelName(row.model_name);

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
  const [eventsOffset, setEventsOffset] = useState(0);
  const [hasMoreEvents, setHasMoreEvents] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [eventsLimit, setEventsLimit] = useState(10);

  const initialRange = defaultRange();
  const [filters, setFilters] = useState({
    start: initialRange.start,
    end: initialRange.end,
    userId: "",
    userName: "",
    email: "",
    language: "",
    country: "",
    eventType: "",
    source: "",
    model: "",
    usageContext: "",
  });
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const activeUser = users.find((user) => user.id === filters.userId);

  const fetchSummary = async () => {
    const params = new URLSearchParams();
    if (filters.start) params.set("start", filters.start);
    if (filters.end) params.set("end", filters.end);
    if (filters.userId) params.set("userId", filters.userId);
    if (filters.userName) params.set("userName", filters.userName);
    if (filters.email) params.set("email", filters.email);
    if (filters.language) params.set("language", filters.language);
    if (filters.country) params.set("country", filters.country);
    if (filters.eventType) params.set("eventType", filters.eventType);
    if (filters.source) params.set("source", filters.source);
    if (filters.model) params.set("model", filters.model);
    if (filters.usageContext) params.set("usageContext", filters.usageContext);
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

  const fetchEvents = async (mode: "replace" | "append" = "replace") => {
    const params = new URLSearchParams();
    if (filters.userId) params.set("userId", filters.userId);
    if (filters.userName) params.set("userName", filters.userName);
    if (filters.email) params.set("email", filters.email);
    if (filters.language) params.set("language", filters.language);
    if (filters.country) params.set("country", filters.country);
    if (filters.eventType) params.set("eventType", filters.eventType);
    if (filters.source) params.set("source", filters.source);
    if (filters.model) params.set("model", filters.model);
    if (filters.usageContext) params.set("usageContext", filters.usageContext);
    if (filters.start) params.set("start", filters.start);
    if (filters.end) params.set("end", filters.end);
    const offset = mode === "append" ? eventsOffset : 0;
    params.set("limit", String(eventsLimit));
    params.set("offset", String(offset));
    const response = await fetch(`/api/events?${params.toString()}`);
    if (!response.ok) return;
    const data = await response.json();
    const nextEvents = data.events ?? [];
    if (mode === "append") {
      setEvents((prev) => [...prev, ...nextEvents]);
      setEventsOffset((prev) => prev + nextEvents.length);
    } else {
      setEvents(nextEvents);
      setEventsOffset(nextEvents.length);
    }
    setHasMoreEvents(Boolean(data.hasMore));
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  useEffect(() => {
    setLoading(true);
    setEventsOffset(0);
    Promise.all([fetchSummary(), fetchEvents("replace")]).finally(() => setLoading(false));
  }, [filters, eventsLimit]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredUsers = users.filter((user) => {
    if (!userQuery.trim()) return true;
    const term = userQuery.trim().toLowerCase();
    return (
      user.id.toLowerCase().includes(term) ||
      (user.name ?? "").toLowerCase().includes(term) ||
      (user.email ?? "").toLowerCase().includes(term)
    );
  });

  const languageOptions = Array.from(
    new Set(users.map((user) => user.language).filter((value): value is string => Boolean(value)))
  ).sort((a, b) => a.localeCompare(b));

  const countryOptions = Array.from(
    new Set(users.map((user) => user.country).filter((value): value is string => Boolean(value)))
  ).sort((a, b) => a.localeCompare(b));

  const selectedUserLabel = (() => {
    if (!filters.userId) return "All users";
    const user = users.find((entry) => entry.id === filters.userId);
    if (!user) return filters.userId.slice(0, 8);
    const name = (user.name ?? "User").trim() || "User";
    return `${name} · ${user.email ?? user.id.slice(0, 8)}`;
  })();

  const handleLoadMore = async () => {
    if (loadingMore || !hasMoreEvents) return;
    setLoadingMore(true);
    try {
      await fetchEvents("append");
    } finally {
      setLoadingMore(false);
    }
  };

  const palette = ["#7c3aed", "#f97316", "#16a34a", "#0ea5e9", "#9333ea", "#f43f5e"];

  const importBySourceSeries = (summary?.sourceImportSeries ?? []).map((series, index) => ({
    name: series.label,
    color: palette[index % palette.length],
    data: series.points.map((point) => ({ label: point.date, value: point.value })),
  }));

  const actionCountSeries = (summary?.actionCountSeries ?? []).map((series, index) => ({
    name: series.label.replaceAll("_", " "),
    color: palette[index % palette.length],
    data: series.points.map((point) => ({ label: point.date, value: point.value })),
  }));

  const contextCountSeries = (summary?.contextCountSeries ?? []).map((series, index) => ({
    name: series.label.replaceAll("_", " "),
    color: palette[index % palette.length],
    data: series.points.map((point) => ({ label: point.date, value: point.value })),
  }));

  const actionCreditSeries = (summary?.actionCreditSeries ?? []).map((series, index) => ({
    name: series.label.replaceAll("_", " "),
    color: palette[index % palette.length],
    data: series.points.map((point) => ({ label: point.date, value: point.value })),
  }));

  const actionCostSeries = (summary?.actionCostSeries ?? []).map((series, index) => ({
    name: series.label.replaceAll("_", " "),
    color: palette[index % palette.length],
    data: series.points.map((point) => ({ label: point.date, value: point.value })),
  }));

  const importsUsed = summary?.currentPeriodImportsUsed ?? 0;
  const translationsUsed = summary?.currentPeriodTranslationsUsed ?? 0;
  const optimizationsUsed = summary?.currentPeriodOptimizationsUsed ?? 0;
  const aiMessagesUsed = summary?.currentPeriodAiMessagesUsed ?? 0;
  const importsAvailable = summary?.totalImportCreditsAvailable ?? 0;
  const translationsAvailable = summary?.totalTranslationCreditsAvailable ?? 0;
  const optimizationsAvailable = summary?.totalOptimizationCreditsAvailable ?? 0;
  const aiMessagesAvailable = summary?.totalAiMessageCreditsAvailable ?? 0;
  const importsProgress = importsAvailable > 0 ? Math.min(importsUsed / importsAvailable, 1) : 0;
  const translationsProgress =
    translationsAvailable > 0 ? Math.min(translationsUsed / translationsAvailable, 1) : 0;
  const optimizationsProgress =
    optimizationsAvailable > 0 ? Math.min(optimizationsUsed / optimizationsAvailable, 1) : 0;
  const aiMessagesProgress =
    aiMessagesAvailable > 0 ? Math.min(aiMessagesUsed / aiMessagesAvailable, 1) : 0;

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
            User name
            <input
              type="text"
              placeholder="Search by name"
              value={filters.userName}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, userName: event.target.value }))
              }
            />
          </label>
          <label>
            Email
            <input
              type="text"
              placeholder="Search by email"
              value={filters.email}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, email: event.target.value }))
              }
            />
          </label>
          <div className="userFilter" ref={dropdownRef}>
            <span>Users</span>
            <button
              type="button"
              className="userSelect"
              onClick={() => setUserDropdownOpen((prev) => !prev)}
            >
              {selectedUserLabel}
            </button>
            {userDropdownOpen ? (
              <div className="userMenu">
                <input
                  type="text"
                  className="userSearch"
                  placeholder="Search name or email"
                  value={userQuery}
                  onChange={(event) => setUserQuery(event.target.value)}
                />
                <button
                  type="button"
                  className={`userOption ${filters.userId ? "" : "active"}`}
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, userId: "" }));
                    setUserDropdownOpen(false);
                  }}
                >
                  All users
                </button>
                <div className="userList">
                  {filteredUsers.map((user) => {
                    const label = `${(user.name ?? "User").trim() || "User"} · ${
                      user.email ?? user.id.slice(0, 8)
                    }`;
                    return (
                      <button
                        type="button"
                        key={user.id}
                        className={`userOption ${filters.userId === user.id ? "active" : ""}`}
                        onClick={() => {
                          setFilters((prev) => ({ ...prev, userId: user.id }));
                          setUserDropdownOpen(false);
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
          <label>
            Action
            <select
              value={filters.eventType}
              onChange={(event) => setFilters((prev) => ({ ...prev, eventType: event.target.value }))}
            >
              <option value="">All actions</option>
              <option value="import">Import</option>
              <option value="scan">Scan</option>
              <option value="manual_add">Manual add</option>
              <option value="optimize">Optimize with AI</option>
              <option value="ai_assistant">AI assistant</option>
              <option value="import_credit">Import credit</option>
            </select>
          </label>
          <label>
            Language
            <select
              value={filters.language}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, language: event.target.value }))
              }
            >
              <option value="">All languages</option>
              {languageOptions.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </label>
          <label>
            Country
            <select
              value={filters.country}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, country: event.target.value }))
              }
            >
              <option value="">All countries</option>
              {countryOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
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
            </select>
          </label>
          <label>
            Usage context
            <select
              value={filters.usageContext}
              onChange={(event) => setFilters((prev) => ({ ...prev, usageContext: event.target.value }))}
            >
              <option value="">All contexts</option>
              <option value="import">Import</option>
              <option value="translation">Translation</option>
              <option value="optimization">Optimization</option>
              <option value="chat">Chat</option>
              <option value="optimized_with_ai">Optimized with AI</option>
            </select>
          </label>
        </div>

        <div className="filterSummary">
          {loading ? "Refreshing..." : activeUser ? `${activeUser.name ?? "User"} selected` : "All users"}
        </div>
      </section>

      <section className="sectionBlock">
        <h2>User overview</h2>
        <div className="statGrid">
          <StatCard label="Total users" value={formatNumber(summary?.totalUsers ?? 0)} />
          <StatCard label="Trial users" value={formatNumber(summary?.trialUsers ?? 0)} accent="orange" />
          <StatCard label="Base users" value={formatNumber(summary?.baseUsers ?? 0)} />
          <StatCard label="Premium users" value={formatNumber(summary?.premiumUsers ?? 0)} accent="green" />
          <StatCard label="Canceled users" value={formatNumber(summary?.canceledUsers ?? 0)} />
          <StatCard
            label="Canceled on trial"
            value={formatNumber(summary?.canceledTrialUsers ?? 0)}
            accent="orange"
          />
          <StatCard
            label="Monthly billing"
            value={formatNumber(
              (summary?.baseMonthlyUsers ?? 0) + (summary?.premiumMonthlyUsers ?? 0)
            )}
          />
          <StatCard
            label="Yearly billing"
            value={formatNumber(
              (summary?.baseYearlyUsers ?? 0) + (summary?.premiumYearlyUsers ?? 0)
            )}
          />
        </div>
      </section>

      <section className="sectionBlock">
        <h2>User distribution</h2>
        <div className="chartGrid">
          <BarChart title="Users by country" data={summary?.usersByCountry ?? []} />
          <BarChart
            title="Users by language"
            data={summary?.usersByLanguage ?? []}
            color="#0ea5e9"
          />
        </div>
      </section>

      <section className="usageSection">
        <div className="usageHeader">
          <p className="usageEyebrow">Monthly usage</p>
          <p className="usageSub">Current period usage against available credits.</p>
        </div>
        <div className="usageGrid">
          <div className="usageCard">
            <div className="usageIcon">📥</div>
            <div>
              <div className="usageValue">{formatNumber(importsUsed)}</div>
              <div className="usageLabel">Recipe imports</div>
              <div className="usageSubLabel">
                Available {formatNumber(importsAvailable)} credits
              </div>
              <div className="usageBar">
                <div className="usageBarFill" style={{ width: `${importsProgress * 100}%` }} />
              </div>
            </div>
          </div>
          <div className="usageCard">
            <div className="usageIcon">🌍</div>
            <div>
              <div className="usageValue">{formatNumber(translationsUsed)}</div>
              <div className="usageLabel">Translations</div>
              <div className="usageSubLabel">
                Available {formatNumber(translationsAvailable)} credits
              </div>
              <div className="usageBar">
                <div className="usageBarFill" style={{ width: `${translationsProgress * 100}%` }} />
              </div>
            </div>
          </div>
          <div className="usageCard">
            <div className="usageIcon">✨</div>
            <div>
              <div className="usageValue">{formatNumber(optimizationsUsed)}</div>
              <div className="usageLabel">Optimizations</div>
              <div className="usageSubLabel">
                Available {formatNumber(optimizationsAvailable)} credits
              </div>
              <div className="usageBar">
                <div className="usageBarFill" style={{ width: `${optimizationsProgress * 100}%` }} />
              </div>
            </div>
          </div>
          <div className="usageCard">
            <div className="usageIcon">💬</div>
            <div>
              <div className="usageValue">{formatNumber(aiMessagesUsed)}</div>
              <div className="usageLabel">AI assistant messages</div>
              <div className="usageSubLabel">
                Available {formatNumber(aiMessagesAvailable)} credits
              </div>
              <div className="usageBar">
                <div className="usageBarFill" style={{ width: `${aiMessagesProgress * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="tablesGrid">
        <DataTable
          title="Total actions & credits"
          rows={summary?.actionTotals ?? []}
          emptyLabel="No actions for this filter."
          columns={[
            {
              key: "action",
              header: "Action",
              render: (row) => row.action.replaceAll("_", " "),
            },
            {
              key: "events",
              header: "Events",
              render: (row) => formatNumber(row.events),
            },
            {
              key: "credits",
              header: "Credits used",
              render: (row) => formatNumber(row.creditsUsed),
            },
            {
              key: "cost",
              header: "Cost",
              render: (row) => (row.costUsd ? formatCurrency(row.costUsd) : "—"),
            },
          ]}
        />
      </section>

      <section className="tablesGrid">
        <DataTable
          title="Usage context totals"
          rows={summary?.contextTotals ?? []}
          emptyLabel="No usage context data for this filter."
          columns={[
            {
              key: "context",
              header: "Context",
              render: (row) => row.context.replaceAll("_", " "),
            },
            {
              key: "events",
              header: "Events",
              render: (row) => formatNumber(row.events),
            },
            {
              key: "credits",
              header: "Credits used",
              render: (row) => formatNumber(row.creditsUsed),
            },
            {
              key: "cost",
              header: "Cost",
              render: (row) => (row.costUsd ? formatCurrency(row.costUsd) : "—"),
            },
          ]}
        />
      </section>

      <section className="tablesGrid">
        <DataTable
          title="Credits inventory (plan, trial, add-ons)"
          rows={summary?.creditInventory ?? []}
          emptyLabel="No credit inventory for this filter."
          columns={[
            {
              key: "action",
              header: "Action",
              render: (row) => row.action.replaceAll("_", " "),
            },
            {
              key: "plan",
              header: "Plan",
              render: (row) => formatNumber(row.planAvailable),
            },
            {
              key: "trial",
              header: "Trial",
              render: (row) => formatNumber(row.trialAvailable),
            },
            {
              key: "addons",
              header: "Add-ons remaining",
              render: (row) => formatNumber(row.addonRemaining),
            },
            {
              key: "purchased",
              header: "Add-ons purchased",
              render: (row) => (row.addonsPurchased === null ? "—" : formatNumber(row.addonsPurchased)),
            },
            {
              key: "used",
              header: "Add-ons used",
              render: (row) => (row.addonsUsed === null ? "—" : formatNumber(row.addonsUsed)),
            },
          ]}
        />
      </section>

      <div className="sectionGrid">
        <section className="sectionBlock">
          <h2>Imports & actions</h2>
          <div className="chartGrid">
            <LineChart
              title="Recipe imports by source"
              series={importBySourceSeries}
              xLabel="Day"
              yLabel="Imports"
              height={220}
            />
            <LineChart
              title="Actions over time"
              series={actionCountSeries}
              xLabel="Day"
              yLabel="Events"
              height={220}
            />
          </div>
        </section>

        <section className="sectionBlock">
          <h2>Credits & context</h2>
          <div className="chartGrid">
            <LineChart
              title="Credits used over time"
              series={actionCreditSeries}
              xLabel="Day"
              yLabel="Credits"
              height={220}
            />
            <LineChart
              title="Usage context over time"
              series={contextCountSeries}
              xLabel="Day"
              yLabel="Events"
              height={220}
            />
          </div>
        </section>
      </div>

      <section className="tablesGrid">
        <DataTable
          title="Usage & cost by model"
          rows={summary?.modelBreakdown ?? []}
          emptyLabel="No model usage for this filter."
          columns={[
            {
              key: "model",
              header: "Model",
              render: (row) => row.label,
            },
            {
              key: "credits",
              header: "Usage",
              render: (row) => {
                if (row.label === "whisper-1") {
                  return `${formatNumber(Math.round(row.aiCredits))}s`;
                }
                if (row.label === "document-text-detection") {
                  return formatNumber(row.aiCredits);
                }
                return formatNumber(row.aiCredits);
              },
            },
            {
              key: "cost",
              header: "Cost",
              render: (row) => (row.costUsd ? formatCurrency(row.costUsd) : "—"),
            },
            {
              key: "events",
              header: "Events",
              render: (row) => formatNumber(row.events),
            },
          ]}
        />
      </section>

      <div className="sectionGrid">
        <section className="sectionBlock">
          <h2>Daily actions</h2>
          <LineChart
            title="Actions per day"
            series={actionCountSeries}
            xLabel="Day"
            yLabel="Events"
            height={220}
          />
        </section>

        <section className="sectionBlock">
          <h2>Credit usage by action</h2>
          <LineChart
            title="Credits by action"
            series={actionCreditSeries}
            xLabel="Day"
            yLabel="Credits"
            height={220}
          />
        </section>

        <section className="sectionBlock">
          <h2>Estimated costs by action</h2>
          <LineChart
            title="Cost by action"
            series={actionCostSeries}
            xLabel="Day"
            yLabel="USD"
            height={220}
          />
        </section>
      </div>

      <section className="tablesGrid">
        <DataTable
          title="Credits & costs by action + model"
          rows={summary?.actionModelBreakdown ?? []}
          emptyLabel="No action breakdown for this filter."
          columns={[
            {
              key: "action",
              header: "Action",
              render: (row) => row.action.replaceAll("_", " "),
            },
            {
              key: "model",
              header: "Model",
              render: (row) => formatModelName(row.model),
            },
            {
              key: "credits",
              header: "Credits",
              render: (row) => {
                if (row.model === "whisper-1") {
                  return `${formatNumber(Math.round(row.credits))}s`;
                }
                if (row.model === "document-text-detection") {
                  return formatNumber(row.credits);
                }
                return formatNumber(row.credits);
              },
            },
            {
              key: "cost",
              header: "Cost",
              render: (row) => (row.costUsd ? formatCurrency(row.costUsd) : "—"),
            },
            {
              key: "events",
              header: "Events",
              render: (row) => formatNumber(row.events),
            },
          ]}
        />
      </section>

      <section className="tablesGrid">
        <DataTable
          title="Costs per user"
          rows={summary?.costByUser ?? []}
          emptyLabel="No cost data for this filter."
          columns={[
            {
              key: "email",
              header: "Email",
              render: (row) => row.email ?? "—",
            },
            {
              key: "imports",
              header: "Imports",
              render: (row) => formatNumber(row.importCredits),
            },
            {
              key: "mini",
              header: "GPT-4o-mini",
              render: (row) => formatNumber(row.gptMiniCredits),
            },
            {
              key: "gpt4o",
              header: "GPT-4o",
              render: (row) => formatNumber(row.gpt4oCredits),
            },
            {
              key: "vision",
              header: "Vision credits",
              render: (row) => formatNumber(row.visionImages),
            },
            {
              key: "whisper",
              header: "Whisper",
              render: (row) => `${formatNumber(Math.round(row.whisperSeconds))}s`,
            },
            {
              key: "total",
              header: "Total cost",
              render: (row) => formatCurrency(row.totalCostUsd),
            },
          ]}
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
              key: "email",
              header: "Email",
              render: (row) => row.user_email ?? "—",
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
              render: (row) => formatEventModel(row),
            },
            {
              key: "credits",
              header: "Credits",
              render: (row) => formatUsageCredits(row),
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
        <div className="tableControls">
          <label className="tableSelect">
            Rows
            <select
              value={eventsLimit}
              onChange={(event) => setEventsLimit(Number(event.target.value))}
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          {hasMoreEvents ? (
            <button className="tableLoadMore" onClick={handleLoadMore} disabled={loadingMore}>
              {loadingMore ? "Loading..." : "Show more"}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
