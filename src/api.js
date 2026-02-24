// src/api.js
export const API_URL = "http://192.168.1.35:8000"; // 🔴 change to your IP or Railway URL

export const api = {
  register: async ({ firstName, lastName, email, phone, password }) => {
    const res  = await fetch(`${API_URL}/register`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ first_name: firstName, last_name: lastName, email, phone, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Registration failed");
    return data;
  },

  login: async ({ email, password }) => {
    const res  = await fetch(`${API_URL}/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Login failed");
    return data;
  },

  me: async (token) => {
    const res  = await fetch(`${API_URL}/me`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Session expired");
    return data;
  },

  // ── Profile ────────────────────────────────────────────────────
  updateProfile: async (token, updates) => {
    const res  = await fetch(`${API_URL}/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to save profile");
    return data;
  },

  // ── Friend requests ────────────────────────────────────────────
  sendFriendRequest: async (token, vibeCode) => {
    const res  = await fetch(`${API_URL}/friends/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ vibe_code: vibeCode }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to send request");
    return data;
  },

  getFriendRequests: async (token) => {
    const res  = await fetch(`${API_URL}/friends/requests`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to load requests");
    return data;
  },

  respondToRequest: async (token, requestId, action) => {
    const res  = await fetch(`${API_URL}/friends/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ request_id: requestId, action }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to respond");
    return data;
  },

  // ── Contacts ───────────────────────────────────────────────────
  getContacts: async (token) => {
    const res  = await fetch(`${API_URL}/contacts`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to load contacts");
    return data;
  },

  // ── Messages ───────────────────────────────────────────────────
  getMessages: async (token, contactId) => {
    const res  = await fetch(`${API_URL}/messages/${contactId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to load messages");
    return data;
  },

  sendMessage: async (token, receiverId, text) => {
    const res  = await fetch(`${API_URL}/messages/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ receiver_id: receiverId, text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to send");
    return data;
  },
};