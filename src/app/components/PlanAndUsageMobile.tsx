import React from "react";
import {
  ArrowLeft,
  Crown,
  Check,
  AlertCircle,
  Download,
  Languages,
  Sparkles,
  MessageCircle,
  Home,
  Compass,
  BookOpen,
  User,
} from "lucide-react";

interface PlanAndUsageMobileProps {
  onBack?: () => void;
  onChangePlan?: () => void;
  onCancelSubscription?: () => void;
  onTabChange?: (tab: "home" | "explore" | "recipes" | "import" | "profile") => void;
}

const usageCards = [
  {
    label: "Recipe Imports",
    used: 12,
    total: 25,
    icon: Download,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    bar: "bg-purple-500",
  },
  {
    label: "AI Translations",
    used: 8,
    total: 25,
    icon: Languages,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    bar: "bg-blue-500",
  },
  {
    label: "AI Optimizations",
    used: 15,
    total: 25,
    icon: Sparkles,
    color: "text-pink-500",
    bg: "bg-pink-500/10",
    bar: "bg-pink-500",
  },
  {
    label: "AI Chat Messages",
    used: 42,
    total: 150,
    icon: MessageCircle,
    color: "text-green-500",
    bg: "bg-green-500/10",
    bar: "bg-green-500",
  },
];

export const PlanAndUsageMobile: React.FC<PlanAndUsageMobileProps> = ({
  onBack,
  onChangePlan,
  onCancelSubscription,
  onTabChange,
}) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="fixed top-0 left-0 right-0 z-20 h-14 bg-gray-900 px-4">
        <div className="flex h-full items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <span className="text-[17px] font-semibold text-white">Recipefy</span>
        </div>
      </header>

      <div className="pt-14">
        <div className="border-b border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-900 hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-[20px] font-semibold text-gray-900">Plan & Usage</h1>
          </div>
        </div>

        <main className="space-y-4 px-4 py-4 pb-24">
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400">
                  <Crown className="h-7 w-7 text-white" />
                </div>
                <div>
                  <p className="text-[17px] font-semibold text-gray-900">Recipefy Premium</p>
                  <p className="mt-0.5 text-[15px] text-gray-500">CHF 69 / year</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onChangePlan}
                className="rounded-full bg-gray-100 px-4 py-2 text-[15px] font-medium text-gray-900"
              >
                Change
              </button>
            </div>

            <div className="mb-4 space-y-2.5">
              {[
                "25 recipe imports per month",
                "25 AI translations per month",
                "25 AI optimizations per month",
                "150 AI chat messages per month",
              ].map((feature) => (
                <div key={feature} className="flex items-start gap-2.5">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100">
                    <Check className="h-3 w-3 text-green-600" strokeWidth={2.5} />
                  </div>
                  <span className="text-[15px] text-gray-600">{feature}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={onCancelSubscription}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-red-200 bg-red-50 text-[15px] font-medium text-red-600"
            >
              <AlertCircle className="h-5 w-5" />
              Cancel subscription
            </button>
          </section>

          <section>
            <p className="mb-3 px-1 text-[12px] font-semibold uppercase tracking-wide text-gray-500">
              Monthly usage
            </p>
            <div className="grid grid-cols-2 gap-3">
              {usageCards.map((card) => {
                const progress = card.total > 0 ? Math.min(100, (card.used / card.total) * 100) : 0;
                const Icon = card.icon;
                return (
                  <div key={card.label} className="rounded-2xl bg-white p-4 shadow-sm">
                    <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${card.bg}`}>
                      <Icon className={`h-5 w-5 ${card.color}`} />
                    </div>
                    <div className="mb-2">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[28px] font-bold leading-[34px] text-gray-900">
                          {card.used}
                        </span>
                        <span className="text-[15px] text-gray-400">/ {card.total}</span>
                      </div>
                      <p className="mt-1 text-[13px] text-gray-600">{card.label}</p>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div className={`h-full ${card.bar}`} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white shadow-lg">
        <div className="flex h-16 items-center justify-around px-2 pb-safe">
          {[
            { id: "home", label: "Home", icon: Home },
            { id: "explore", label: "Explore", icon: Compass },
            { id: "recipes", label: "Recipes", icon: BookOpen },
            { id: "import", label: "Import", icon: Download, badge: "1" },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange?.(tab.id as any)}
                className="relative flex flex-1 flex-col items-center justify-center gap-1"
              >
                <Icon className="h-6 w-6 text-gray-400" />
                {tab.badge ? (
                  <span className="absolute right-5 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[11px] font-bold text-white">
                    {tab.badge}
                  </span>
                ) : null}
                <span className="text-[11px] text-gray-500">{tab.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onTabChange?.("profile")}
            className="flex flex-1 items-center justify-center"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-900">
              <User className="h-5 w-5 text-white" />
            </div>
          </button>
        </div>
      </nav>
    </div>
  );
};
