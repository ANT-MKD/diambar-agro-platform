import { createFileRoute } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/farmer/page-header";
import { conversations, farmers } from "@/data/mocks";
import { relativeTime } from "@/lib/format";

export const Route = createFileRoute("/restaurant/messages")({
  head: () => ({ meta: [{ title: "Messages · Restaurant" }] }),
  component: Messages,
});

function Messages() {
  // Adapter conversations agriculteur ↔ restaurant : on garde la même mock structure
  const list = conversations.map((c) => ({ ...c, farmer: farmers[conversations.indexOf(c) % farmers.length] }));
  const [active, setActive] = useState(list[0]);
  const [draft, setDraft] = useState("");

  return (
    <div className="space-y-4">
      <PageHeader title="Messages" subtitle="Discutez directement avec vos producteurs" />
      <div className="glass rounded-2xl grid grid-cols-1 md:grid-cols-[280px_1fr] overflow-hidden h-[600px]">
        <div className="border-r border-border overflow-auto">
          {list.map((c) => (
            <button key={c.id} onClick={() => setActive(c)} className={`w-full text-left p-3 flex gap-3 border-b border-border hover:bg-accent/30 ${active.id === c.id ? "bg-accent/30" : ""}`}>
              <img src={c.farmer.avatar} alt="" className="h-10 w-10 rounded-xl object-cover" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2"><span className="font-semibold text-sm truncate">{c.farmer.farm}</span><span className="text-[10px] text-muted-foreground">{relativeTime(c.lastAt)}</span></div>
                <div className="text-[11px] text-muted-foreground truncate">{c.lastMessage}</div>
              </div>
              {c.unread > 0 && <span className="text-[10px] font-bold rounded-full bg-primary text-primary-foreground h-5 min-w-5 px-1 grid place-items-center">{c.unread}</span>}
            </button>
          ))}
        </div>
        <div className="flex flex-col">
          <div className="border-b border-border p-3 flex items-center gap-3">
            <img src={active.farmer.avatar} alt="" className="h-10 w-10 rounded-xl object-cover" />
            <div><div className="font-semibold text-sm">{active.farmer.farm}</div><div className="text-[11px] text-muted-foreground">{active.farmer.city}</div></div>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {active.messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${m.from === "me" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{m.text}</div>
              </div>
            ))}
          </div>
          <div className="border-t border-border p-3 flex items-center gap-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Écrire un message…" className="flex-1 h-10 px-3 rounded-xl border border-border bg-background text-sm outline-none" />
            <button onClick={() => setDraft("")} className="h-10 w-10 rounded-xl bg-primary text-primary-foreground grid place-items-center"><Send className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}