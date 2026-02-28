/**
 * OllamaTerminal Component
 *
 * Chat panel for homelab-agent (localhost:30802/chat).
 * Sends messages and displays responses with tool call badges.
 * While waiting, sets ollamaIsTyping in the game store so the sprite animates.
 */

"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { useGameStore } from "@/stores/gameStore";

// ============================================================================
// TYPES
// ============================================================================

interface ToolCall {
  tool: string;
  result: string;
}

interface OllamaChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  backend?: string;
  toolCalls?: ToolCall[];
}

// ============================================================================
// COMPONENT
// ============================================================================

export function OllamaTerminal(): ReactNode {
  const [messages, setMessages] = useState<OllamaChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const setOllamaTyping = useGameStore((state) => state.setOllamaTyping);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userContent = input.trim();
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    const userMsg: OllamaChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: userContent,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setError(null);
    setOllamaTyping(true);

    try {
      const res = await fetch("http://localhost:30802/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userContent, history }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      const assistantMsg: OllamaChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        backend: data.backend,
        toolCalls: data.tool_calls,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bağlantı hatası");
    } finally {
      setIsLoading(false);
      setOllamaTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">🦙</span>
          <span className="font-bold text-orange-400 uppercase tracking-wider">Ollama</span>
          {isLoading && (
            <span className="text-[10px] text-orange-400 animate-pulse">● düşünüyor...</span>
          )}
        </div>
        <button
          onClick={() => setMessages([])}
          className="p-1 text-slate-600 hover:text-slate-400 transition-colors"
          title="Sohbeti temizle"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-grow min-h-0 overflow-y-auto p-2 flex flex-col gap-2">
        {messages.length === 0 && (
          <div className="flex-grow flex items-center justify-center text-slate-600 text-[11px] italic text-center px-4">
            Homelab Kubernetes asistanınıza mesaj gönderin
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[85%] px-2.5 py-1.5 rounded-lg border text-[11px] leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-cyan-950/40 border-cyan-700/40 text-cyan-200"
                  : "bg-orange-950/30 border-orange-700/30 text-orange-100"
              }`}
            >
              {msg.content}
            </div>

            {/* Tool calls */}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="flex flex-wrap gap-1 max-w-[85%]">
                {msg.toolCalls.map((tc, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-400"
                    title={tc.result.slice(0, 200)}
                  >
                    ⚙ {tc.tool}
                  </span>
                ))}
              </div>
            )}

            {/* Backend badge */}
            {msg.backend && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                msg.backend === "ollama"
                  ? "text-orange-500 bg-orange-950/30"
                  : "text-violet-400 bg-violet-950/30"
              }`}>
                [{msg.backend}]
              </span>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-start gap-1">
            <div className="px-2.5 py-1.5 bg-orange-950/30 border border-orange-700/30 rounded-lg text-orange-400 text-[11px] animate-pulse">
              ▊▊▊
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-2.5 py-1.5 bg-rose-950/30 border border-rose-700/30 rounded-lg text-rose-400 text-[11px]">
            ⚠ {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-slate-800 p-2 flex flex-col gap-1.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Mesajınızı yazın..."
          disabled={isLoading}
          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-[11px] text-slate-200 placeholder-slate-600 outline-none focus:border-orange-600/60 disabled:opacity-50 transition-colors"
        />
        <button
          onClick={() => void sendMessage()}
          disabled={isLoading || !input.trim()}
          className="w-full py-1.5 bg-orange-600/20 hover:bg-orange-600/30 disabled:opacity-40 text-orange-400 border border-orange-600/30 rounded text-[11px] font-bold uppercase tracking-wider transition-colors"
        >
          {isLoading ? "Gönderiliyor..." : "Gönder ↵"}
        </button>
      </div>
    </div>
  );
}
