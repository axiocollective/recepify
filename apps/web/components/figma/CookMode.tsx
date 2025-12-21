'use client';

import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Timer, CheckCircle } from "lucide-react";
import type { Recipe } from "@recepify/shared/types/figma";
import { formatIngredientText } from "@recepify/shared/lib/utils";

interface CookModeProps {
  recipe: Recipe;
  onExit: () => void;
}

export function CookMode({ recipe, onExit }: CookModeProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showTimer, setShowTimer] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerFinished, setTimerFinished] = useState(false);
  const [showAllIngredients, setShowAllIngredients] = useState(false);
  const [hasAlarmPlayed, setHasAlarmPlayed] = useState(false);
  const [timerSecondsSetting, setTimerSecondsSetting] = useState(0);

  const adjustTimerMinutes = (delta: number) => {
    setTimerMinutes((prev) => Math.max(0, prev + delta));
  };

  const adjustTimerSecondsSetting = (delta: number) => {
    setTimerSecondsSetting((prev) => {
      const next = prev + delta;
      if (next < 0) return 0;
      if (next > 59) return 59;
      return next;
    });
  };

  const goToNextStep = () => {
    if (currentStep < recipe.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  useEffect(() => {
    if (!timerRunning) {
      return;
    }

      const interval = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setTimerRunning(false);
            setTimerFinished(true);
            setHasAlarmPlayed(false);
            return 0;
          }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerRunning]);

  useEffect(() => {
    if (!timerFinished || hasAlarmPlayed) {
      return;
    }
    setHasAlarmPlayed(true);

    if (typeof window === "undefined") {
      return;
    }

    type AudioContextConstructor = typeof window.AudioContext;
    type WindowWithWebkit = Window & { webkitAudioContext?: AudioContextConstructor };
    const AudioContextClass =
      window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    try {
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0, now);

      oscillator.connect(gain);
      gain.connect(context.destination);

      // Three longer pulses for a more noticeable alarm.
      const pulseGap = 1.2;
      for (let i = 0; i < 3; i += 1) {
        const start = now + i * pulseGap;
        gain.gain.linearRampToValueAtTime(0.28, start + 0.05);
        gain.gain.setValueAtTime(0.28, start + 0.35);
        gain.gain.linearRampToValueAtTime(0, start + 0.5);
        oscillator.frequency.setValueAtTime(i % 2 === 0 ? 880 : 740, start);
      }

      const stopAt = now + 3.8;
      oscillator.start(now);
      oscillator.stop(stopAt);
      oscillator.onended = () => context.close();

      if ("vibrate" in navigator) {
        navigator.vibrate([200, 120, 200, 120, 200, 600, 200]);
      }
    } catch {
      // ignore if AudioContext not available
    }
  }, [timerFinished, hasAlarmPlayed]);

  const isLastStep = currentStep === recipe.steps.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex-1">
          <p className="text-xs text-gray-500">Cook Mode</p>
          <h1 className="text-lg line-clamp-1">{recipe.title}</h1>
        </div>
        <button
          onClick={onExit}
          className="w-9 h-9 hover:bg-gray-100 rounded-full flex items-center justify-center transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Progress */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-600">
            Step {currentStep + 1} of {recipe.steps.length}
          </span>
          <span className="text-xs text-gray-600">
            {Math.round(((currentStep + 1) / recipe.steps.length) * 100)}%
          </span>
        </div>
        <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-black transition-all duration-300"
            style={{
              width: `${((currentStep + 1) / recipe.steps.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="w-12 h-12 bg-black text-white rounded-lg flex items-center justify-center mb-6 text-lg">
            {currentStep + 1}
          </div>
          
          <p className="text-xl leading-relaxed mb-8">
            {recipe.steps[currentStep]}
          </p>

          {/* Timer Section */}
          {!showTimer ? (
            <button
              onClick={() => setShowTimer(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm"
            >
              <Timer className="w-4 h-4" />
              <span>Set a timer</span>
            </button>
          ) : (
            <div className="p-5 bg-gray-50 rounded-lg space-y-4">
              {timerRunning ? (
                <>
                  <div className="text-center">
                    <div className="text-3xl font-semibold">
                      {String(Math.floor(timerSeconds / 60)).padStart(2, "0")}:
                      {String(timerSeconds % 60).padStart(2, "0")}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Counting down</p>
                    {timerFinished && (
                      <p className="text-xs text-emerald-600 mt-2">Time’s up! ⏰</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setTimerRunning(false);
                        setTimerSeconds(0);
                        setTimerFinished(false);
                        setHasAlarmPlayed(false);
                      }}
                      className="flex-1 py-2 bg-white rounded-lg border border-gray-200 text-sm font-semibold hover:bg-gray-100"
                    >
                      Stop
                    </button>
                    <button
                      onClick={() => {
                        setShowTimer(false);
                        setTimerRunning(false);
                        setTimerSeconds(0);
                        setTimerFinished(false);
                        setHasAlarmPlayed(false);
                      }}
                      className="flex-1 py-2 bg-black text-white rounded-lg text-sm font-semibold hover:bg-gray-800"
                    >
                      Close
                    </button>
                  </div>
                </>
                  ) : (
                    <>
                      <div className="flex items-center gap-4">
                    <button
                      onClick={() => adjustTimerMinutes(-1)}
                      className="w-9 h-9 bg-white rounded-full flex items-center justify-center border border-gray-200 hover:bg-gray-50 text-sm"
                    >
                      -
                    </button>
                    <div className="flex-1 text-center">
                      <div className="text-3xl">
                        {String(timerMinutes).padStart(2, "0")}:
                        {String(timerSecondsSetting).padStart(2, "0")}
                      </div>
                      <div className="text-xs text-gray-500">minutes : seconds</div>
                    </div>
                    <button
                      onClick={() => adjustTimerMinutes(1)}
                      className="w-9 h-9 bg-white rounded-full flex items-center justify-center border border-gray-200 hover:bg-gray-50 text-sm"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center justify-between pt-2 text-xs text-gray-500">
                    <span>Seconds granularity</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => adjustTimerSecondsSetting(-5)}
                        className="px-3 py-1 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 text-xs"
                      >
                        -5s
                      </button>
                      <span>{String(timerSecondsSetting).padStart(2, "0")}s</span>
                      <button
                        onClick={() => adjustTimerSecondsSetting(5)}
                        className="px-3 py-1 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 text-xs"
                      >
                        +5s
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const totalSeconds = timerMinutes * 60 + timerSecondsSetting;
                          if (totalSeconds <= 0) return;
                          setTimerSeconds(totalSeconds);
                          setTimerRunning(true);
                          setTimerFinished(false);
                          setHasAlarmPlayed(false);
                        }}
                        className="flex-1 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm disabled:opacity-50"
                        disabled={timerMinutes * 60 + timerSecondsSetting <= 0}
                      >
                        Start Timer
                      </button>
                    <button
                      onClick={() => {
                        setShowTimer(false);
                        setTimerSeconds(0);
                        setTimerRunning(false);
                        setTimerFinished(false);
                        setHasAlarmPlayed(false);
                      }}
                      className="flex-1 py-2.5 bg-white rounded-lg border border-gray-200 text-sm font-semibold hover:bg-gray-100"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Ingredients Quick Reference */}
          {currentStep === 0 && (
            <div className="mt-8 p-5 bg-gray-50 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-gray-600" />
                <h3 className="text-sm font-semibold">Quick Reference: Ingredients</h3>
              </div>
              <ul className="space-y-1.5 text-xs">
                {(showAllIngredients ? recipe.ingredients : recipe.ingredients.slice(0, 5)).map(
                  (ingredient, index) => (
                    <li key={ingredient.id ?? index} className="text-gray-600 flex items-start gap-2">
                      <span>•</span>
                      <span>{formatIngredientText(ingredient)}</span>
                    </li>
                  )
                )}
              </ul>
              {recipe.ingredients.length > 5 && (
                <button
                  onClick={() => setShowAllIngredients((prev) => !prev)}
                  className="text-left text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showAllIngredients
                    ? "Show fewer ingredients"
                    : `Show ${recipe.ingredients.length - 5} more ingredients`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="border-t border-gray-200 p-6">
        <div className="flex gap-3">
          <button
            onClick={goToPreviousStep}
            disabled={isFirstStep}
            className={`flex items-center justify-center gap-2 px-5 py-3 rounded-lg transition-colors text-sm ${
              isFirstStep
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          {!isLastStep ? (
            <button
              onClick={goToNextStep}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
            >
              <span>Next Step</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onExit}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Complete</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
