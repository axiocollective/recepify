'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Lock,
  HelpCircle,
  LogOut,
  ChevronRight,
  Sparkles,
  MoreHorizontal,
} from "lucide-react";

type StatusMessage = {
  type: "success" | "error";
  text: string;
};

const inputClasses =
  "w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[17px] leading-[22px] text-gray-900 transition focus:border-gray-400 focus:outline-none min-h-[44px]";

interface ProfileProps {
  name: string;
  email: string;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onLogout: () => void;
}

type EditableField = "name" | "email" | null;

export function Profile({ name, email, onNameChange, onEmailChange, onLogout }: ProfileProps) {
  const [pendingName, setPendingName] = useState(name);
  const [pendingEmail, setPendingEmail] = useState(email);
  const [isEditing, setIsEditing] = useState<EditableField>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  useEffect(() => {
    setPendingName(name);
  }, [name]);

  useEffect(() => {
    setPendingEmail(email);
  }, [email]);

  const handleEditToggle = (field: EditableField) => {
    setIsEditing((prev) => (prev === field ? null : field));
    if (field === "name") {
      setPendingName(name);
    }
    if (field === "email") {
      setPendingEmail(email);
    }
  };

  const handlePasswordSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setStatusMessage({ type: "error", text: "Please fill in all password fields." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatusMessage({ type: "error", text: "New passwords must match." });
      return;
    }
    setStatusMessage({ type: "success", text: "Password updated successfully." });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setIsPasswordModalOpen(false);
  };

  const handleLogout = () => {
    onLogout();
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="px-5 pt-16 pb-6">
        <p className="text-[13px] leading-[18px] text-gray-500 mb-1">Settings</p>
        <h1 className="text-[34px] leading-[41px] font-bold mb-2 text-gray-900">Manage your account</h1>
        <p className="text-[15px] leading-[20px] text-gray-500">Update your details and stay secure.</p>
      </div>

      <div className="px-5 pb-16 space-y-10">
        {statusMessage && (
          <div
            className={`rounded-2xl px-5 py-4 text-[15px] leading-[20px] shadow-sm ${
              statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-600"
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        <section className="space-y-3">
          <p className="text-[11px] leading-[14px] uppercase tracking-wider text-gray-400 font-semibold">Profile</p>
          <EditableCard
            label="Name"
            value={pendingName}
            isEditing={isEditing === "name"}
            placeholder="Enter your name"
            onChange={setPendingName}
            onEditToggle={() => handleEditToggle("name")}
            onCancel={() => {
              setPendingName(name);
              setIsEditing(null);
            }}
            onSave={() => {
              const next = pendingName.trim();
              if (!next) {
                setStatusMessage({ type: "error", text: "Name cannot be empty." });
                return;
              }
              onNameChange(next);
              setPendingName(next);
              setIsEditing(null);
              setStatusMessage({ type: "success", text: "Name updated." });
            }}
          />
          <EditableCard
            label="Email"
            value={pendingEmail}
            isEditing={isEditing === "email"}
            placeholder="Enter your email"
            onChange={setPendingEmail}
            onEditToggle={() => handleEditToggle("email")}
            onCancel={() => {
              setPendingEmail(email);
              setIsEditing(null);
            }}
            onSave={() => {
              const next = pendingEmail.trim();
              if (!next.includes("@")) {
                setStatusMessage({ type: "error", text: "Please enter a valid email." });
                return;
              }
              onEmailChange(next);
              setPendingEmail(next);
              setIsEditing(null);
              setStatusMessage({ type: "success", text: "Email updated." });
            }}
          />
        </section>

        <section className="space-y-3">
          <p className="text-[11px] leading-[14px] uppercase tracking-wider text-gray-400 font-semibold">Security</p>
          <MenuAction
            icon={Lock}
            title="Change password"
            description="Update your password"
            onClick={() => setIsPasswordModalOpen(true)}
          />
        </section>

        <section className="space-y-3">
          <p className="text-[11px] leading-[14px] uppercase tracking-wider text-gray-400 font-semibold">Support</p>
          <MenuAction
            icon={HelpCircle}
            title="Help & Support"
            description="Get help or contact us"
            onClick={() => setIsSupportModalOpen(true)}
          />
        </section>

        <button
          onClick={handleLogout}
          className="w-full rounded-2xl border border-red-200 bg-red-50/70 p-5 flex items-center justify-between text-left shadow-sm transition active:bg-red-50 min-h-[80px]"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-red-500">
              <LogOut className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[17px] leading-[22px] font-semibold text-red-600">Log out</p>
              <p className="text-[13px] leading-[18px] text-red-500">Sign out of your account</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-red-400" />
        </button>
      </div>

      {isPasswordModalOpen && (
        <Overlay title="Change password" onClose={() => setIsPasswordModalOpen(false)}>
          <form className="space-y-4" onSubmit={handlePasswordSubmit}>
            <label className="text-[15px] leading-[20px] font-medium text-gray-700">
              Current password
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className={`${inputClasses} mt-2`}
              />
            </label>
            <label className="text-[15px] leading-[20px] font-medium text-gray-700">
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className={`${inputClasses} mt-2`}
              />
            </label>
            <label className="text-[15px] leading-[20px] font-medium text-gray-700">
              Confirm new password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className={`${inputClasses} mt-2`}
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-full bg-gray-900 px-6 py-3 text-[17px] leading-[22px] font-semibold text-white transition active:bg-gray-800 min-h-[44px]"
            >
              Update password
            </button>
          </form>
        </Overlay>
      )}

      {isSupportModalOpen && (
        <Overlay title="Help & Support" onClose={() => setIsSupportModalOpen(false)}>
          <div className="space-y-4 text-[15px] leading-[20px] text-gray-600">
            <p>Need help with Recipefy? Reach out to our team anytime.</p>
            <div className="rounded-2xl border border-gray-200 px-4 py-3">
              <p className="font-medium text-gray-900">Email</p>
              <p>support@recipefy.app</p>
            </div>
            <div className="rounded-2xl border border-gray-200 px-4 py-3">
              <p className="font-medium text-gray-900">Response time</p>
              <p>We typically respond within 24 hours on business days.</p>
            </div>
            <button
              onClick={() => {
                setIsSupportModalOpen(false);
                setStatusMessage({ type: "success", text: "Support request sent." });
              }}
              className="w-full rounded-full bg-gray-900 px-6 py-3 text-[17px] leading-[22px] font-semibold text-white transition active:bg-gray-800 min-h-[44px]"
            >
              Send message
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

interface EditableCardProps {
  label: string;
  value: string;
  placeholder: string;
  isEditing: boolean;
  onEditToggle: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function EditableCard({
  label,
  value,
  placeholder,
  isEditing,
  onEditToggle,
  onChange,
  onSave,
  onCancel,
}: EditableCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] leading-[14px] uppercase tracking-wider text-gray-400 font-semibold">{label}</p>
          {!isEditing && <p className="text-[17px] leading-[22px] font-medium text-gray-900 mt-1">{value}</p>}
        </div>
        <button
          onClick={onEditToggle}
          className="w-9 h-9 rounded-full border border-gray-200 text-gray-500 flex items-center justify-center active:bg-gray-50"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
      {isEditing && (
        <div className="mt-3 space-y-3">
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className={inputClasses}
          />
          <div className="flex gap-2">
            <button
              onClick={onSave}
              className="flex-1 rounded-full bg-gray-900 px-4 py-2.5 text-[15px] leading-[20px] font-semibold text-white active:bg-gray-800"
            >
              Save
            </button>
            <button
              onClick={onCancel}
              className="flex-1 rounded-full border border-gray-200 px-4 py-2.5 text-[15px] leading-[20px] font-medium text-gray-600 active:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface MenuActionProps {
  icon: React.ElementType;
  title: string;
  description: string;
  onClick: () => void;
}

function MenuAction({ icon: Icon, title, description, onClick }: MenuActionProps) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl border border-gray-200 bg-white p-4 flex items-center justify-between text-left shadow-sm transition hover:border-gray-300"
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center">
          <Icon className="w-5 h-5 text-gray-700" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{title}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400" />
    </button>
  );
}

interface OverlayProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

function Overlay({ title, onClose, children }: OverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-800">
            <Sparkles className="w-4 h-4 text-gray-400" />
            <h2 className="text-base font-semibold">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50"
          >
            <span className="text-base text-gray-500">&times;</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
