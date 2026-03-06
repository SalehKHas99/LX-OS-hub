"use client";
import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Shell from "../../../_components/Shell";
import { apiGet } from "../../../_components/api";

export default function WebhookDeliveriesPage() {
  const { webhookId } = useParams<{ webhookId: string }>();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!webhookId) return;
    apiGet(`/webhooks/${webhookId}/deliveries?limit=100`).then(setDeliveries).catch(console.error).finally(() => setLoading(false));
  }, [webhookId]);

  return (
    <Shell title="Webhook Deliveries">
      {loading && <div style={{ color: "var(--text-muted)" }}>Loading…</div>}
      {!loading && (
        <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-elevated)" }}>
                {["Time","Attempt","Status","HTTP","Latency","Error"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)" }}>{new Date(d.created_at).toLocaleString()}</td>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--mono)", fontSize: 11 }}>{d.attempt_no}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: d.status === "sent" ? "var(--green)" : "var(--red)" }}>{d.status}</span>
                  </td>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--mono)", fontSize: 11 }}>{d.http_status || "—"}</td>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--mono)", fontSize: 11 }}>{d.response_ms ? `${d.response_ms}ms` : "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--red)" }}>{d.error || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {deliveries.length === 0 && <div style={{ padding: 20, color: "var(--text-muted)", textAlign: "center" }}>No deliveries yet</div>}
        </div>
      )}
    </Shell>
  );
}
