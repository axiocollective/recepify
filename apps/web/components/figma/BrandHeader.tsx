'use client';

import { ChefHat } from "lucide-react";

export function BrandHeader() {
  return (
    <div className="bg-slate-900 text-white px-6 py-4 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
        <ChefHat className="w-4 h-4 text-white" />
      </div>
      <span className="text-[17px] leading-[22px] font-semibold">Recepify</span>
    </div>
  );
}
