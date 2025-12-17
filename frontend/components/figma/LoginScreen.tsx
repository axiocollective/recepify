'use client';

import { Apple, Mail } from "lucide-react";

interface LoginScreenProps {
  onContinue: () => void;
}

export function LoginScreen({ onContinue }: LoginScreenProps) {
  return (
    <div className="min-h-screen bg-white px-6 py-12 flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center mb-6">
        <span className="text-2xl font-semibold">R</span>
      </div>
      <h1 className="text-2xl font-semibold text-gray-900">Recipefy</h1>
      <p className="text-gray-500 mt-2">A home for all your recipes</p>

      <div className="w-full max-w-sm mt-10 space-y-3">
        <button
          onClick={onContinue}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-black text-white py-3 text-sm font-medium hover:bg-gray-900 transition"
        >
          <Apple className="w-4 h-4" />
          Continue with Apple
        </button>
        <button
          onClick={onContinue}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 transition"
        >
          <svg className="w-4 h-4" viewBox="0 0 533.5 544.3">
            <path fill="#4285f4" d="M533.5 278.4c0-18.5-1.5-37.1-4.7-55.3H272v104.8h147.3c-6.2 33.3-25.5 61.5-54.1 80.4v66h87.4c51 46.9 80.9 116.1 80.9 191.7z" />
            <path fill="#34a853" d="M272 544.3c73.7 0 135.5-24.3 180.7-66.2l-87.4-66c-24.2 15.9-55.3 25.3-93.3 25.3-71.5 0-132.2-47.9-154-112.5H28.1v70.4C74.7 486.7 165.4 544.3 272 544.3z" />
            <path fill="#fbbc04" d="M118 324.9c-10.8-31.9-10.8-66.5 0-98.4V156H28.1c-19 36.5-28 77-28 121.6s9 85.1 28 121.6z" />
            <path fill="#ea4335" d="M272 107.7c38.6-.6 75.4 13.9 103.6 41l77.4-77.4C409.3 27.4 340.6.1 272 0 165.4 0 74.7 57.6 28.1 156l89.9 70.4C139.8 155.6 200.5 107.7 272 107.7z" />
          </svg>
          Continue with Google
        </button>
        <button
          onClick={onContinue}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 transition"
        >
          <Mail className="w-4 h-4" />
          Continue with Email
        </button>
      </div>
    </div>
  );
}
