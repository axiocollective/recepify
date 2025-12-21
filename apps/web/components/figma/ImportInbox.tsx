'use client';

import NextImage from "next/image";
import { ArrowLeft, Loader2, CheckCircle, AlertCircle, Download, Trash2, Link2 } from "lucide-react";
import type { ImportItem, SocialPlatform } from "@recepify/shared/types/figma";

interface ImportInboxProps {
  items: ImportItem[];
  onBack: () => void;
  onAction: (itemId: string, action: "open" | "connect" | "retry" | "delete") => void;
}

export function ImportInbox({ items, onBack, onAction }: ImportInboxProps) {
  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-11 h-11 rounded-full active:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-[17px] leading-[22px] font-semibold">Shared Recipes</h1>
            <p className="text-[13px] leading-[18px] text-gray-500">Your import inbox</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-6 space-y-4">
        {items.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <Link2 className="w-9 h-9 text-gray-400" />
            </div>
            <h2 className="text-[22px] leading-[28px] font-bold mb-3">No shared recipes yet</h2>
            <p className="text-[15px] leading-[20px] text-gray-500 max-w-sm mx-auto mb-8">
              Share any TikTok, Instagram, Pinterest or web recipe from your phone and it will show up here instantly.
            </p>
            <button
              onClick={onBack}
              className="px-6 py-3 bg-gray-900 text-white rounded-full active:bg-gray-800 transition-colors text-[15px] leading-[20px] font-medium min-h-[44px]"
            >
              Start importing
            </button>
          </div>
        ) : (
          items.map((item) => (
            <ImportItemCard
              key={item.id}
              item={item}
              timeAgo={getTimeAgo(item.timestamp)}
              onAction={(action) => onAction(item.id, action)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface ImportItemCardProps {
  item: ImportItem;
  timeAgo: string;
  onAction: (action: "open" | "connect" | "retry" | "delete") => void;
}

function ImportItemCard({ item, timeAgo, onAction }: ImportItemCardProps) {
  const statusMeta = getStatusMeta(item);
  const isProcessing = item.status === "processing";
  const handlePrimary = () => {
    if (item.status === "ready") {
      onAction("open");
    } else if (item.status === "needsConnection") {
      onAction("connect");
    } else if (item.status === "failed") {
      onAction("retry");
    }
  };

  return (
    <div className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="p-5 flex gap-4">
        <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0">
          {item.thumbnail ? (
            <NextImage
              fill
              sizes="72px"
              src={item.thumbnail}
              alt={item.title}
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <Link2 className="w-7 h-7" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="flex items-start gap-2">
            {getPlatformIcon(item.platform)}
            <h3 className="text-[17px] leading-[22px] font-semibold text-gray-900 line-clamp-2">{item.title}</h3>
          </div>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] leading-[18px] font-medium ${statusMeta.pillClass}`}>
            {statusMeta.icon}
            {statusMeta.label}
          </div>
          <div className="flex items-center gap-2 text-[13px] leading-[18px] text-gray-500">
            <span>{statusMeta.description}</span>
            <span>•</span>
            <span>{timeAgo}</span>
          </div>
        </div>
      </div>
      <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 flex items-center gap-2">
        <button
          onClick={handlePrimary}
          disabled={isProcessing}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[15px] leading-[20px] font-medium transition min-h-[44px] ${
            isProcessing ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-gray-900 text-white active:bg-gray-800"
          }`}
        >
          <Download className="w-4 h-4" />
          {statusMeta.primaryLabel}
        </button>
        <button
          onClick={() => onAction("delete")}
          className="w-11 h-11 flex items-center justify-center rounded-full border border-gray-200 text-gray-600 active:bg-white transition-colors"
          aria-label="Delete import"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function getStatusMeta(item: ImportItem) {
  switch (item.status) {
    case "ready":
      return {
        pillClass: "bg-green-50 text-green-700",
        icon: <CheckCircle className="w-4 h-4" />,
        label: "Ready",
        description: "Ready to import",
        primaryLabel: "Import",
      };
    case "processing":
      return {
        pillClass: "bg-blue-50 text-blue-600",
        icon: <Loader2 className="w-4 h-4 animate-spin" />,
        label: "Processing",
        description: "Extracting ingredients and steps...",
        primaryLabel: "Processing...",
      };
    case "needsConnection":
      return {
        pillClass: "bg-amber-50 text-amber-700",
        icon: <AlertCircle className="w-4 h-4" />,
        label: "Needs connection",
        description: `Connect your ${item.platform} account to import`,
        primaryLabel: "Import",
      };
    case "failed":
    default:
      return {
        pillClass: "bg-red-50 text-red-600",
        icon: <AlertCircle className="w-4 h-4" />,
        label: "Failed",
        description: "Could not extract recipe",
        primaryLabel: "Try again",
      };
  }
}

const platformColors: Record<SocialPlatform | "web", string> = {
  tiktok: "text-gray-900",
  instagram: "text-pink-500",
  pinterest: "text-red-500",
  web: "text-gray-400",
};

function getPlatformIcon(platform: SocialPlatform | "web") {
  const common = "w-4 h-4 flex-shrink-0 mt-1";
  switch (platform) {
    case "tiktok":
      return (
        <svg className={`${common} ${platformColors[platform]}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
        </svg>
      );
    case "instagram":
      return (
        <svg className={`${common} ${platformColors[platform]}`} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
          <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" />
        </svg>
      );
    case "pinterest":
      return (
        <svg className={`${common} ${platformColors[platform]}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z" />
        </svg>
      );
    default:
      return <Link2 className={common} />;
  }
}
