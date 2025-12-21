'use client';

import { useState } from "react";
import { ChefHat } from "lucide-react";

interface LoginScreenProps {
  onSubmit: (payload: { name: string; email: string }) => void;
}

export function LoginScreen({ onSubmit }: LoginScreenProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    onSubmit({ name: trimmedName, email: trimmedEmail });
  };

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gray-50 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md rounded-[32px] bg-white shadow-xl p-8 space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gray-900 text-white flex items-center justify-center">
            <ChefHat className="w-8 h-8" />
          </div>
          <div>
            <p className="text-[13px] leading-[18px] text-gray-500 mb-1">Welcome to Recipefy</p>
            <h1 className="text-[28px] leading-[34px] font-bold text-gray-900">Sign in to continue</h1>
          </div>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="text-[15px] leading-[20px] text-gray-700 font-medium">
              Name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3.5 text-[15px] leading-[20px] text-gray-900 transition focus:border-gray-400 focus:outline-none"
                placeholder="Your name"
              />
            </label>
          </div>
          <div>
            <label className="text-[15px] leading-[20px] text-gray-700 font-medium">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3.5 text-[15px] leading-[20px] text-gray-900 transition focus:border-gray-400 focus:outline-none"
                placeholder="you@example.com"
              />
            </label>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-gray-900 text-white rounded-2xl text-[15px] leading-[20px] font-semibold hover:bg-gray-800 transition-colors disabled:bg-gray-300"
          >
            {isSubmitting ? "Signing in..." : "Continue"}
          </button>
        </form>
        <p className="text-xs text-gray-500 text-center leading-relaxed">
          By continuing, you agree to our Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
