// src/api.js
export const API_URL = "http://192.168.1.36:8000"; // 🔴 change to your IP or Railway URL

export const api = {
  register: async ({ firstName, lastName, email, phone, password }) => {
    const res  = await fetch(`${API_URL}/register`, { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ first_name:firstName, last_name:lastName, email, phone, password }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Registration failed");
    return data;
  },
  login: async ({ email, password }) => {
    const res  = await fetch(`${API_URL}/login`, { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Login failed");
    return data;
  },
  me: async (token) => {
    const res  = await fetch(`${API_URL}/me`, { headers:{ Authorization:`Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Session expired");
    return data;
  },
  updateProfile: async (token, updates) => {
    const res  = await fetch(`${API_URL}/profile`, { method:"PUT",
      headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`},
      body: JSON.stringify(updates) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to save profile");
    return data;
  },
  sendFriendRequest: async (token, vibeCode) => {
    const res  = await fetch(`${API_URL}/friends/request`, { method:"POST",
      headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`},
      body: JSON.stringify({ vibe_code: vibeCode }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to send request");
    return data;
  },
  getFriendRequests: async (token) => {
    const res  = await fetch(`${API_URL}/friends/requests`, { headers:{ Authorization:`Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to load requests");
    return data;
  },
  respondToRequest: async (token, requestId, action) => {
    const res  = await fetch(`${API_URL}/friends/respond`, { method:"POST",
      headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`},
      body: JSON.stringify({ request_id:requestId, action }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to respond");
    return data;
  },
  getContacts: async (token) => {
    const res  = await fetch(`${API_URL}/contacts`, { headers:{ Authorization:`Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to load contacts");
    return data;
  },
  getMessages: async (token, contactId) => {
    const res  = await fetch(`${API_URL}/messages/${contactId}`, { headers:{ Authorization:`Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to load messages");
    return data;
  },
  // Updated: supports msg_type (text, image, gif, voice)
  sendMessage: async (token, receiverId, text, msgType = 'text') => {
    const res  = await fetch(`${API_URL}/messages/send`, { method:"POST",
      headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`},
      body: JSON.stringify({ receiver_id:receiverId, text, msg_type: msgType }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to send");
    return data;
  },

  // ── Contact actions ────────────────────────────────────────────────
  setNickname: async (token, contactId, nickname) => {
    const res  = await fetch(`${API_URL}/contacts/${contactId}/nickname`, { method:"POST",
      headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`},
      body: JSON.stringify({ nickname }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to set nickname");
    return data;
  },
  blockUser: async (token, contactId) => {
    const res  = await fetch(`${API_URL}/contacts/${contactId}/block`, { method:"POST",
      headers:{ Authorization:`Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to block");
    return data;
  },
  reportUser: async (token, contactId) => {
    const res  = await fetch(`${API_URL}/contacts/${contactId}/report`, { method:"POST",
      headers:{ Authorization:`Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to report");
    return data;
  },
  deleteChat: async (token, contactId) => {
    const res  = await fetch(`${API_URL}/messages/${contactId}`, { method:"DELETE",
      headers:{ Authorization:`Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to delete chat");
    return data;
  },

  // ── Groups ─────────────────────────────────────────────────────────
  createGroup: async (token, name, image, inviteUserIds) => {
    const res  = await fetch(`${API_URL}/groups/create`, { method:"POST",
      headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`},
      body: JSON.stringify({ name, image, invite_user_ids: inviteUserIds }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to create group");
    return data;
  },
  getGroups: async (token) => {
    const res  = await fetch(`${API_URL}/groups`, { headers:{ Authorization:`Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to load groups");
    return data;
  },
  getGroupMessages: async (token, groupId) => {
    const res  = await fetch(`${API_URL}/groups/${groupId}/messages`, { headers:{ Authorization:`Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to load group messages");
    return data;
  },
  sendGroupMessage: async (token, groupId, text) => {
    const res  = await fetch(`${API_URL}/groups/${groupId}/message`, { method:"POST",
      headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`},
      body: JSON.stringify({ group_id:groupId, text }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to send");
    return data;
  },
  updateGroup: async (token, groupId, updates) => {
    const res  = await fetch(`${API_URL}/groups/${groupId}`, { method:"PUT",
      headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`},
      body: JSON.stringify(updates) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to update group");
    return data;
  },
  deleteGroup: async (token, groupId) => {
    const res  = await fetch(`${API_URL}/groups/${groupId}`, { method:"DELETE",
      headers:{ Authorization:`Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to delete group");
    return data;
  },
  leaveGroup: async (token, groupId) => {
    const res  = await fetch(`${API_URL}/groups/${groupId}/leave`, { method:"POST",
      headers:{ Authorization:`Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to leave group");
    return data;
  },
  inviteToGroup: async (token, groupId, userIds) => {
    const res  = await fetch(`${API_URL}/groups/${groupId}/invite`, { method:"POST",
      headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`},
      body: JSON.stringify({ user_ids: userIds }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to send invites");
    return data;
  },
  getGroupInvites: async (token) => {
    const res  = await fetch(`${API_URL}/groups/invites/pending`, { headers:{ Authorization:`Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to load invites");
    return data;
  },
  respondToGroupInvite: async (token, inviteId, action) => {
    const res  = await fetch(`${API_URL}/groups/invites/respond`, { method:"POST",
      headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`},
      body: JSON.stringify({ invite_id:inviteId, action }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to respond");
    return data;
  },
};