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
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Welcome to Recepify</p>
            <h1 className="text-2xl font-semibold text-gray-900">Sign in to continue</h1>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-medium text-gray-700">
              Full name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 transition focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                placeholder="e.g. Andi Schmidt"
              />
            </label>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">
              Email address
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 transition focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                placeholder="you@example.com"
              />
            </label>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Checking..." : "Continue"}
          </button>
        </form>
        <p className="text-xs text-gray-500 text-center leading-relaxed">
          This lightweight login stores your name and email locally so you can test Recepify without a
          full authentication setup.
        </p>
      </div>
    </div>
  );
}
