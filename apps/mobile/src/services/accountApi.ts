const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export const deleteUserAccount = async (userId: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/users/me`, {
    method: "DELETE",
    headers: {
      "X-User-Id": userId,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || "Failed to delete account.");
  }
};
