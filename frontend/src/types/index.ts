export interface User {
  id: string; username: string; email: string; role: string
  bio: string | null; avatar_url: string | null
  public_key?: string | null
  created_at?: string; prompt_count?: number
}
export interface Tag { id: string; slug: string; display_name: string }
export interface PromptImage {
  id: string; prompt_id: string; image_url: string
  alt_text: string | null; sort_order: number
}
export interface ContextBlock { id: string; field_name: string; field_value: string; sort_order: number }
export interface Creator { id: string; username: string; avatar_url: string | null }
export interface PromptCard {
  id: string; title: string; model_family: string | null; score: number
  creator: Creator; tags: Tag[]; images: PromptImage[]; created_at: string
  current_user_vote?: number | null  // 1 upvote, -1 downvote, null not voted
  is_saved?: boolean | null  // bookmark/save (distinct from vote)
}
export interface PromptDetail extends PromptCard {
  raw_prompt: string; negative_prompt: string | null; notes: string | null
  status: string; community_id: string | null; remix_of_id: string | null
  context_blocks: ContextBlock[]; updated_at: string
}
export interface Comment {
  id: string; content: string; user: Creator
  parent_comment_id: string | null; moderation_state: string
  created_at: string; replies: Comment[]
  vote_score?: number
  current_user_vote?: number | null  // 1 upvote, -1 downvote, null not voted
}
export interface Community {
  id: string
  slug: string
  title: string
  description: string | null
  rules: string | null
  visibility: string
  owner_id?: string | null
  owner_username?: string | null
  avatar_url: string | null
  banner_url?: string | null
  announcement?: string | null
  show_owner_badge?: boolean
  created_at: string
  member_count?: number
  prompt_count?: number
}

// ── Messaging ─────────────────────────────────────────────────────────────────
export interface Message {
  id: string
  sender_id: string
  recipient_id: string
  sender_username: string | null
  content: string
  created_at: string
  read_at: string | null
  is_from_me: boolean
}

export interface MessagesWithResponse {
  messages: Message[]
  has_more: boolean
  next_before: string | null
  other_user_id?: string | null
  other_username?: string | null
}

export interface ConversationSummary {
  other_user_id: string
  other_username: string
  last_message_preview: string | null
  last_at: string | null
  unread_count: number
}

export interface Friend {
  user_id: string
  username: string
  status: 'accepted' | 'pending'
  created_at: string
}

export interface BlockedUser {
  user_id: string
  username: string
  blocked_at: string
}

// Community wall post (frontend-only type — backed by /communities/{slug}/posts)
export interface CommunityPost {
  id: string; content: string; author: Creator
  created_at: string; reply_count?: number
}

export interface JoinRequest {
  id: string; user_id: string; username: string; status: string; created_at: string
}

export interface CommunityMember {
  user_id: string; username: string; role: string; joined_at: string
}

export interface ModeratorInvite {
  id: string
  community_id: string
  community_slug: string
  community_title: string
  invited_by_username: string
  status: string
  created_at: string
}

export interface CommunityBan {
  user_id: string
  username: string
  banned_by_username: string
  reason: string | null
  created_at: string
}

export interface Collection {
  id: string; title: string; description: string | null
  owner_id: string; created_at: string
}

/** Collection detail from GET /collections/:id — includes full prompt cards */
export interface CollectionDetail extends Collection {
  prompts: PromptCard[]
}
export interface PaginatedResponse<T> {
  items: T[]; total: number; page: number; page_size: number; has_more: boolean
}
export interface AuthTokens { access_token: string; refresh_token: string; token_type: string }
export interface ContextBlockResult { field_name: string; field_value: string; confidence: number }
export interface Suggestion { field: string; issue: string; recommendation: string }
export interface AdapterExports { midjourney: string; dalle: string; stable_diffusion: string; flux: string }
export interface ParseResponse {
  context_blocks: ContextBlockResult[]; completeness_score: number
  missing_fields: string[]; suggestions: Suggestion[]
  assumptions: string[]; adapter_exports: AdapterExports
}
export interface OptimizeResponse {
  original_prompt: string; optimized_prompt: string
  completeness_before: number; completeness_after: number
  changes_made: string[]; adapter_exports: AdapterExports
}

export interface Notification {
  id: string
  notification_type: string
  entity_type: string
  entity_id: string
  entity_slug?: string | null
  prompt_id?: string | null  // when entity_type is comment, for link to prompt page
  message: string
  is_read: boolean
  created_at: string
  actor_username: string | null
}
