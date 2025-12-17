'use client';

import { Apple, Mail } from "lucide-react";

interface LoginScreenProps {
  onContinue: () => void;
}

const RecipefyMark = () => (
  <svg
    className="h-7 w-7 text-white"
    viewBox="0 0 32 32"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M9.355 4.57a2 2 0 0 1 1.932-1.57h9.426a2 2 0 0 1 1.934 1.57l.71 3.591a4.7 4.7 0 0 1-1.591 4.494v11.96A3.385 3.385 0 0 1 18.39 28H13.6a3.385 3.385 0 0 1-3.366-3.385V12.655a4.7 4.7 0 0 1-1.592-4.494zM6.75 13.875a1.25 1.25 0 1 1 2.5 0V22.5a4.75 4.75 0 0 0 4.75 4.75h3.75a4.75 4.75 0 0 0 4.75-4.75v-8.625a1.25 1.25 0 1 1 2.5 0V22.5a7.25 7.25 0 0 1-7.25 7.25H14A7.25 7.25 0 0 1 6.75 22.5z" />
  </svg>
);

const GoogleGlyph = () => (
  <svg className="h-5 w-5" viewBox="0 0 533.5 544.3" aria-hidden="true">
    <path
      fill="#4285f4"
      d="M533.5 278.4c0-18.5-1.5-37.1-4.7-55.3H272v104.8h147.3c-6.2 33.3-25.5 61.5-54.1 80.4v66h87.4c51 46.9 80.9 116.1 80.9 191.7z"
    />
    <path
      fill="#34a853"
      d="M272 544.3c73.7 0 135.5-24.3 180.7-66.2l-87.4-66c-24.2 15.9-55.3 25.3-93.3 25.3-71.5 0-132.2-47.9-154-112.5H28.1v70.4C74.7 486.7 165.4 544.3 272 544.3z"
    />
    <path
      fill="#fbbc04"
      d="M118 324.9c-10.8-31.9-10.8-66.5 0-98.4V156H28.1c-19 36.5-28 77-28 121.6s9 85.1 28 121.6z"
    />
    <path
      fill="#ea4335"
      d="M272 107.7c38.6-.6 75.4 13.9 103.6 41l77.4-77.4C409.3 27.4 340.6.1 272 0 165.4 0 74.7 57.6 28.1 156l89.9 70.4C139.8 155.6 200.5 107.7 272 107.7z"
    />
  </svg>
);

export function LoginScreen({ onContinue }: LoginScreenProps) {
  return (
    <div className="flex min-h-[calc(100vh-3rem)] w-full items-center justify-center bg-white px-6 py-10">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0f0b23]">
            <RecipefyMark />
          </div>
          <span className="text-[28px] font-semibold leading-none text-[#0f0b23]">Recipefy</span>
        </div>
        <p className="text-lg text-[#5f6b7b]">A home for all your recipes</p>

        <div className="mt-10 space-y-3">
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-black text-base font-semibold text-white transition hover:bg-black/90"
          >
            <Apple className="h-5 w-5" aria-hidden="true" />
            Continue with Apple
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[18px] border border-[#e4e7ec] bg-white text-base font-semibold text-[#101828] transition hover:bg-[#f5f7fb]"
          >
            <GoogleGlyph />
            Continue with Google
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[18px] border border-[#e4e7ec] bg-white text-base font-semibold text-[#101828] transition hover:bg-[#f5f7fb]"
          >
            <Mail className="h-5 w-5" aria-hidden="true" />
            Continue with Email
          </button>
        </div>
      </div>
    </div>
  );
}
