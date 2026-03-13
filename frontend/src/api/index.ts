import api from './client'

export { api }
import type {
  AuthTokens, User, PromptCard, PromptDetail, PaginatedResponse,
  Comment, Community, Collection, ParseResponse, OptimizeResponse, Notification,
  JoinRequest, CommunityMember, CommunityPost, ModeratorInvite, CommunityBan,
  Message, ConversationSummary
} from '../types'

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: { username: string; email: string; password: string }) =>
    api.post<AuthTokens>('/auth/register', data),

  // backend expects: { login, password } where login is username or email
  login: (data: { login: string; password: string }) =>
    api.post<AuthTokens>('/auth/login', data),

  me: () => api.get<User>('/auth/me'),
}

// ── Prompts ───────────────────────────────────────────────────────────────────
export const promptsApi = {
  feed: (page = 1, sort = 'trending') =>
    api.get<PaginatedResponse<PromptCard>>(`/prompts/feed?page=${page}&sort=${sort}`),

  get: (id: string) => api.get<PromptDetail>(`/prompts/${id}`),

  create: (data: object) => api.post<PromptDetail>('/prompts', data),

  update: (id: string, data: object) => api.patch<PromptDetail>(`/prompts/${id}`, data),

  delete: (id: string) => api.delete(`/prompts/${id}`),

  save: (id: string) => api.post(`/prompts/${id}/save`),

  unsave: (id: string) => api.delete(`/prompts/${id}/save`),

  comments: (id: string) => api.get<Comment[]>(`/prompts/${id}/comments`),

  addComment: (id: string, content: string, parent_comment_id?: string) =>
    api.post<Comment>(`/prompts/${id}/comments`, { content, parent_comment_id }),
}

// ── Search ────────────────────────────────────────────────────────────────────
export const searchApi = {
  search: (params: { q?: string; model?: string; tag?: string; sort?: string; page?: number }) =>
    api.get<PaginatedResponse<PromptCard>>('/search', { params }),
}

// ── Communities ───────────────────────────────────────────────────────────────
export const communitiesApi = {
  list: () => api.get<Community[]>('/communities'),

  get: (slug: string) => api.get<Community>(`/communities/${slug}`),

  membership: (slug: string) =>
    api.get<{ status: string; role?: string | null }>(`/communities/${slug}/membership`),

  requestJoin: (slug: string) =>
    api.post(`/communities/${slug}/join-request`),

  listJoinRequests: (slug: string, status: 'pending' | 'approved' | 'rejected' = 'pending') =>
    api.get<JoinRequest[]>(`/communities/${slug}/join-requests?status=${status}`),

  approveJoinRequest: (slug: string, requestId: string) =>
    api.post(`/communities/${slug}/join-requests/${requestId}/approve`),

  rejectJoinRequest: (slug: string, requestId: string) =>
    api.post(`/communities/${slug}/join-requests/${requestId}/reject`),

  listMembers: (slug: string) =>
    api.get<CommunityMember[]>(`/communities/${slug}/members`),

  setMemberRole: (slug: string, userId: string, role: 'member' | 'moderator') =>
    api.patch(`/communities/${slug}/members/${userId}`, { role }),

  inviteModerator: (slug: string, userId: string) =>
    api.post<{ id: string; status: string; message: string }>(`/communities/${slug}/moderator-invite`, { user_id: userId }),

  listModeratorInvites: (slug: string) =>
    api.get<{ id: string; user_id: string; username: string }[]>(`/communities/${slug}/moderator-invites`),

  banUser: (slug: string, userId: string, reason?: string) =>
    api.post<{ status: string; user_id: string }>(`/communities/${slug}/ban`, { user_id: userId, reason }),

  listBans: (slug: string) =>
    api.get<CommunityBan[]>(`/communities/${slug}/bans`),

  unbanUser: (slug: string, userId: string) =>
    api.delete(`/communities/${slug}/bans/${userId}`),

  create: (data: object) => api.post<Community>('/communities', data),

  prompts: (slug: string, page = 1) =>
    api.get<PaginatedResponse<PromptCard>>(`/communities/${slug}/prompts?page=${page}`),

  uploadAvatar: (slug: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<Community>(`/communities/${slug}/avatar`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  update: (slug: string, data: { title?: string; description?: string; rules?: string; announcement?: string; show_owner_badge?: boolean }) =>
    api.patch<Community>(`/communities/${slug}`, data),

  uploadBanner: (slug: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<Community>(`/communities/${slug}/banner`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

// ── Collections ───────────────────────────────────────────────────────────────
export const collectionsApi = {
  mine: () => api.get<Collection[]>('/collections/mine'),

  get: (id: string) => api.get(`/collections/${id}`),

  create: (data: object) => api.post<Collection>('/collections', data),

  addPrompt: (collectionId: string, promptId: string) =>
    api.post(`/collections/${collectionId}/prompts/${promptId}`),

  removePrompt: (collectionId: string, promptId: string) =>
    api.delete(`/collections/${collectionId}/prompts/${promptId}`),
}

// ── Profiles ──────────────────────────────────────────────────────────────────
export const profilesApi = {
  get: (username: string) => api.get<User>(`/users/${username}`),

  prompts: (username: string, page = 1) =>
    api.get<PaginatedResponse<PromptCard>>(`/users/${username}/prompts?page=${page}`),

  updateMe: (data: { bio?: string; avatar_url?: string }) =>
    api.patch<User>('/users/me/profile', data),
}

// ── Uploads ───────────────────────────────────────────────────────────────────
export const uploadsApi = {
  uploadImage: (promptId: string, file: File, altText?: string) => {
    const form = new FormData()
    form.append('prompt_id', promptId)
    form.append('file', file)
    if (altText) form.append('alt_text', altText)
    return api.post('/uploads/prompt-image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<{ avatar_url: string }>('/uploads/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

// ── Context Lab ───────────────────────────────────────────────────────────────
export const labApi = {
  parse: (raw_prompt: string, model_family?: string) =>
    api.post<ParseResponse>('/lab/parse', { raw_prompt, model_family }),

  optimize: (raw_prompt: string, target_model: string, goals?: string[]) =>
    api.post<OptimizeResponse>('/lab/optimize', { raw_prompt, target_model, goals }),

  saveVersion: (data: { prompt_id: string; adapter_family: string; compiled_prompt: string; compile_notes?: string }) =>
    api.post('/lab/save-version', data),

  versions: (promptId: string) =>
    api.get(`/lab/versions/${promptId}`),
}

// ── Community Posts (wall) ─────────────────────────────────────────────────────
export interface CommunityPostsResponse {
  items: CommunityPost[]
  total: number
}
export const communityPostsApi = {
  list: (slug: string) =>
    api.get<CommunityPostsResponse>(`/communities/${slug}/posts`).catch(() => ({
      data: { items: [], total: 0 } as CommunityPostsResponse
    })),

  create: (slug: string, content: string) =>
    api.post<CommunityPost>(`/communities/${slug}/posts`, { content }),
}

// ── Messages ─────────────────────────────────────────────────────────────────
export const messagesApi = {
  listConversations: () =>
    api.get<ConversationSummary[]>('/messages/conversations'),

  getWith: (userId: string, params?: { limit?: number; before?: string }) =>
    api.get<Message[]>(`/messages/with/${userId}`, { params }),

  send: (recipientId: string, content: string) =>
    api.post<Message>('/messages', { recipient_id: recipientId, content }),

  markRead: (userId: string) =>
    api.post<void>('/messages/mark-read', null, { params: { user_id: userId } }),
}

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsApi = {
  list: (opts?: { unread_only?: boolean; limit?: number }) =>
    api.get<Notification[]>('/notifications', { params: opts ?? { unread_only: false, limit: 20 } }),

  markRead: (ids: string[]) =>
    api.post<void>('/notifications/mark-read', { ids }),
}

// ── Moderator invites (accept/reject) ──────────────────────────────────────────
export const moderatorInvitesApi = {
  listMine: () => api.get<ModeratorInvite[]>('/moderator-invites'),

  accept: (inviteId: string) =>
    api.post<{ status: string; community_slug: string }>(`/moderator-invites/${inviteId}/accept`),

  reject: (inviteId: string) =>
    api.post<{ status: string }>(`/moderator-invites/${inviteId}/reject`),
}