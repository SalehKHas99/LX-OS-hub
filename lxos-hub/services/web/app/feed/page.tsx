"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Shell from "../_components/Shell";
import { apiGet, apiPost, apiDelete } from "../_components/api";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const POST_TYPE_COLORS: Record<string, string> = {
  share: "var(--accent)",
  review: "var(--green)",
  question: "var(--amber)",
  showcase: "#a855f7",
};

const POST_TYPE_LABELS: Record<string, string> = {
  share: "Shared",
  review: "Review",
  question: "Question",
  showcase: "Showcase",
};

function Avatar({ user }: { user: any }) {
  const name = user?.display_name || user?.username || "?";
  const initial = name[0].toUpperCase();
  return user?.avatar_url ? (
    <img src={user.avatar_url} alt={name} width={34} height={34} style={{ borderRadius: "50%", objectFit: "cover" }} />
  ) : (
    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--accent-dim)", border: "1px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "var(--accent)", flexShrink: 0 }}>
      {initial}
    </div>
  );
}

function PostCard({ post, onUpdate }: { post: any; onUpdate: () => void }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [loadingComments, setLoadingComments] = useState(false);

  async function toggleLike() {
    if (liked) {
      await apiDelete(`/posts/${post.id}/like`).catch(() => {});
      setLiked(false); setLikeCount((n: number) => Math.max(n - 1, 0));
    } else {
      await apiPost(`/posts/${post.id}/like`).catch(() => {});
      setLiked(true); setLikeCount((n: number) => n + 1);
    }
  }

  async function loadComments() {
    if (loadingComments) return;
    setLoadingComments(true);
    const data = await apiGet(`/posts/${post.id}/comments`).catch(() => []);
    setComments(Array.isArray(data) ? data : []);
    setLoadingComments(false);
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    await apiPost(`/posts/${post.id}/comments`, { body: commentBody });
    setCommentBody("");
    loadComments();
  }

  const toggleComments = () => {
    if (!showComments) loadComments();
    setShowComments(c => !c);
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20, marginBottom: 14 }}>
      {/* Header */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
        <Avatar user={post.author} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>
              {post.author?.display_name || post.author?.username || "Anonymous"}
            </span>
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "var(--bg-elevated)", color: POST_TYPE_COLORS[post.post_type] || "var(--text-muted)", border: `1px solid ${POST_TYPE_COLORS[post.post_type] || "var(--border)"}20` }}>
              {POST_TYPE_LABELS[post.post_type] || post.post_type}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: "auto" }}>{timeAgo(post.created_at)}</span>
          </div>
          {post.prompt && (
            <Link href={`/library/${post.prompt.id}`} style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none", marginTop: 2, display: "block" }}>
              ◈ {post.prompt.title} {post.prompt.category ? `· ${post.prompt.category}` : ""}
            </Link>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ fontSize: 14, lineHeight: 1.65, color: "var(--text)", marginBottom: 14, whiteSpace: "pre-wrap" }}>
        {post.body}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <button onClick={toggleLike} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: liked ? "var(--accent)" : "var(--text-muted)", fontWeight: liked ? 700 : 400, padding: 0 }}>
          <span style={{ fontSize: 14 }}>{liked ? "♥" : "♡"}</span> {likeCount}
        </button>
        <button onClick={toggleComments} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-muted)", padding: 0 }}>
          <span style={{ fontSize: 13 }}>💬</span> {post.comment_count}
        </button>
        {post.prompt && (
          <Link href={`/lab?pvId=${post.prompt.id}`} style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto", textDecoration: "none" }}>
            ▶ Try it
          </Link>
        )}
      </div>

      {/* Comments section */}
      {showComments && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          {loadingComments && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading…</div>}
          {comments.map(c => (
            <div key={c.id} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <Avatar user={c.author} />
              <div style={{ flex: 1, background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: "10px 14px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                  {c.author?.display_name || c.author?.username}
                  <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 400, marginLeft: 8 }}>{timeAgo(c.created_at)}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>{c.body}</div>
              </div>
            </div>
          ))}
          <form onSubmit={addComment} style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input value={commentBody} onChange={e => setCommentBody(e.target.value)}
              placeholder="Write a comment…"
              style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13 }} />
            <button type="submit" style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "0 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              Post
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function FeedPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [form, setForm] = useState({ body: "", post_type: "share", prompt_id: "" });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("all");

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet("/posts?limit=40");
      setPosts(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPosts();
    apiGet("/prompts?limit=30").then(d => setPrompts(Array.isArray(d) ? d : [])).catch(() => {});
  }, [loadPosts]);

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!form.body.trim()) return;
    setSubmitting(true); setMsg("");
    try {
      await apiPost("/posts", {
        body: form.body,
        post_type: form.post_type,
        prompt_id: form.prompt_id || undefined,
      });
      setForm({ body: "", post_type: "share", prompt_id: "" });
      setShowCompose(false);
      loadPosts();
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
    setSubmitting(false);
  }

  const filtered = filter === "all" ? posts : posts.filter(p => p.post_type === filter);

  return (
    <Shell title="Community Feed">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "start" }}>
        {/* Main feed */}
        <div>
          {/* Compose bar */}
          {!showCompose ? (
            <div onClick={() => setShowCompose(true)} style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 18px", marginBottom: 20, cursor: "pointer", color: "var(--text-muted)", fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg-elevated)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✎</div>
              Share a prompt, tip or question with the community…
            </div>
          ) : (
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--accent)", borderRadius: "var(--radius)", padding: 20, marginBottom: 20 }}>
              <form onSubmit={submitPost} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 10 }}>
                  {(["share","review","question","showcase"] as const).map(t => (
                    <button type="button" key={t} onClick={() => setForm(f => ({...f, post_type: t}))}
                      style={{ fontSize: 11, padding: "5px 12px", borderRadius: 999, border: `1px solid ${form.post_type === t ? POST_TYPE_COLORS[t] : "var(--border)"}`, background: form.post_type === t ? "var(--bg-elevated)" : "transparent", color: form.post_type === t ? POST_TYPE_COLORS[t] : "var(--text-muted)", cursor: "pointer", fontWeight: form.post_type === t ? 700 : 400 }}>
                      {POST_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>

                <select value={form.prompt_id} onChange={e => setForm(f => ({...f, prompt_id: e.target.value}))}
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13 }}>
                  <option value="">— Link a prompt (optional) —</option>
                  {prompts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>

                <textarea value={form.body} onChange={e => setForm(f => ({...f, body: e.target.value}))}
                  rows={4} placeholder="What's on your mind? Share a prompt, tip, question or showcase…"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 14px", color: "var(--text)", fontSize: 13, resize: "vertical" }} />

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button type="submit" disabled={submitting || !form.body.trim()}
                    style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "10px 22px", cursor: "pointer", fontWeight: 700, fontSize: 13, opacity: !form.body.trim() ? 0.5 : 1 }}>
                    {submitting ? "Posting…" : "Post"}
                  </button>
                  <button type="button" onClick={() => setShowCompose(false)}
                    style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 16px", cursor: "pointer", fontSize: 13 }}>
                    Cancel
                  </button>
                  <span style={{ fontSize: 12, color: "var(--text-dim)", marginLeft: "auto" }}>{form.body.length}/2000</span>
                </div>
                {msg && <div style={{ fontSize: 12, color: "var(--red)" }}>{msg}</div>}
              </form>
            </div>
          )}

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {["all","share","review","question","showcase"].map(t => (
              <button key={t} onClick={() => setFilter(t)}
                style={{ fontSize: 11, padding: "5px 12px", borderRadius: 999, border: `1px solid ${filter === t ? "var(--accent)" : "var(--border)"}`, background: filter === t ? "var(--accent-dim)" : "transparent", color: filter === t ? "var(--accent)" : "var(--text-muted)", cursor: "pointer" }}>
                {t === "all" ? "All" : POST_TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {loading && <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: 13 }}>
              No posts yet — be the first to share something!
            </div>
          )}
          {filtered.map(post => (
            <PostCard key={post.id} post={post} onUpdate={loadPosts} />
          ))}
        </div>

        {/* Sidebar */}
        <div style={{ position: "sticky", top: 20 }}>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 18, marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700 }}>What to post</h3>
            {[
              { type: "share", label: "Share a prompt", desc: "Show off a DSL you built" },
              { type: "review", label: "Write a review", desc: "Rate and review a prompt" },
              { type: "question", label: "Ask a question", desc: "Get help from the community" },
              { type: "showcase", label: "Showcase results", desc: "Share outputs from a run" },
            ].map(item => (
              <div key={item.type} onClick={() => { setForm(f => ({...f, post_type: item.type})); setShowCompose(true); }}
                style={{ padding: "8px 0", borderBottom: "1px solid var(--border-soft)", cursor: "pointer" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: POST_TYPE_COLORS[item.type] }}>{item.label}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 18 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700 }}>Quick links</h3>
            {[
              { href: "/library", label: "Browse Library" },
              { href: "/app", label: "Build a Prompt" },
              { href: "/lab", label: "Run in Lab" },
              { href: "/auth/register", label: "Create Account" },
            ].map(l => (
              <Link key={l.href} href={l.href} style={{ display: "block", fontSize: 12, color: "var(--accent)", padding: "5px 0", textDecoration: "none", borderBottom: "1px solid var(--border-soft)" }}>
                {l.label} →
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}
