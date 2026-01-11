import React, { useMemo, useState } from "react";
import { Check } from "lucide-react";

type BillingPeriod = "monthly" | "yearly";
type PlanId = "base" | "premium";

interface PlanOption {
  id: PlanId;
  name: string;
  yearlyPrice: string;
  monthlyPrice: string;
  features: string[];
}

interface PlanAndUsageProps {
  currentPlan?: PlanId;
  onClose?: () => void;
}

const planOptions: PlanOption[] = [
  {
    id: "base",
    name: "Recepify Base",
    yearlyPrice: "CHF 15",
    monthlyPrice: "CHF 1.50",
    features: [
      "Add recipes manually",
      "Access all recipes",
      "Collections & favorites",
      "Buy extra credits for imports, translations, optimizations & AI chat",
    ],
  },
  {
    id: "premium",
    name: "Recepify Premium",
    yearlyPrice: "CHF 69",
    monthlyPrice: "CHF 6.90",
    features: [
      "25 recipe imports per month",
      "25 translations per month",
      "25 optimizations per month",
      "150 AI messages per month",
      "Everything from Recepify Base",
    ],
  },
];

export const PlanAndUsage: React.FC<PlanAndUsageProps> = ({ currentPlan = "premium", onClose }) => {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("yearly");
  const [selectedPlan, setSelectedPlan] = useState<PlanId>(currentPlan);

  const selectedDetails = useMemo(
    () => planOptions.find((plan) => plan.id === selectedPlan),
    [selectedPlan]
  );

  const showConfirm = selectedPlan !== currentPlan;

  return (
    <div className="flex min-h-screen items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-[28px] bg-white p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-[20px] font-semibold text-gray-900">Change Plan</h2>
            <p className="text-[13px] text-gray-500">Choose the plan that fits you</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400">
            ✕
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-full bg-gray-100 p-1">
          {(["monthly", "yearly"] as const).map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setBillingPeriod(period)}
              className={`rounded-full px-4 py-1 text-[13px] font-medium ${
                billingPeriod === period ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              {period === "monthly" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {planOptions.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const isCurrent = currentPlan === plan.id;
            const price = billingPeriod === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
            const periodLabel = billingPeriod === "yearly" ? "/ year" : "/ month";
            return (
              <button
                key={plan.id}
                type="button"
                disabled={isCurrent}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative w-full rounded-3xl border-2 p-5 text-left transition-all ${
                  isSelected && !isCurrent
                    ? "border-purple-200 bg-purple-50"
                    : isCurrent
                    ? "cursor-default border-gray-300 bg-white"
                    : "border-gray-200 bg-white hover:border-gray-300 active:scale-[0.98]"
                }`}
              >
                {isSelected && !isCurrent && (
                  <span className="absolute right-5 top-5 flex h-7 w-7 items-center justify-center rounded-full bg-purple-600 shadow-md">
                    <Check className="h-4 w-4 text-white" strokeWidth={3} />
                  </span>
                )}
                {isCurrent && (
                  <span className="absolute -top-2.5 right-4 flex items-center gap-1.5 rounded-full bg-gray-900 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white">
                    <Check className="h-3.5 w-3.5 text-white" />
                    Current
                  </span>
                )}
                <h3 className="text-[20px] font-bold text-gray-900">{plan.name}</h3>
                <p className="mt-1 text-[13px] text-gray-500">
                  Billed {billingPeriod === "yearly" ? "yearly" : "monthly"}
                </p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-[36px] font-bold leading-[42px] text-gray-900">{price}</span>
                  <span className="text-[15px] text-gray-500">{periodLabel}</span>
                </div>
                <div className="mt-4 space-y-2">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 text-gray-600" />
                      <span className="text-[13px] leading-[18px] text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {showConfirm && selectedDetails && (
        <div className="fixed bottom-0 left-0 right-0 bg-white px-6 pb-6 pt-4">
          <button
            type="button"
            className="h-14 w-full rounded-full bg-purple-600 text-[17px] font-semibold text-white shadow-lg shadow-purple-600/20 hover:bg-purple-700 active:scale-[0.98]"
          >
            Confirm Change to {selectedDetails.name}
          </button>
        </div>
      )}
    </div>
  );
};
