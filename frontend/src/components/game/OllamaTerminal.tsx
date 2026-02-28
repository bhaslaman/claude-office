/**
 * OllamaTerminal Component
 *
 * Chat panel for homelab agents.
 * - Agent selector dropdown (fetched from agent-registry :30810)
 * - SSE streaming via /chat/stream with fallback to /chat
 * - Tool call progress badges
 * - Session memory via session_id
 */

"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { Trash2, ChevronDown } from "lucide-react";
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
  model?: string;
  agent?: string;
  toolCalls?: ToolCall[];
  streaming?: boolean;
}

interface AgentInfo {
  name: string;
  url: string;
  model: string;
  description: string;
  tools: string[];
}

const REGISTRY_URL = "http://localhost:30810";
const DEFAULT_AGENT_URL = "http://localhost:30802";
const DEFAULT_AGENT_NAME = "homelab-agent";
const SESSION_ID = typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).slice(2);

// ============================================================================
// COMPONENT
// ============================================================================

export function OllamaTerminal(): ReactNode {
  const [messages, setMessages] = useState<OllamaChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo>({
    name: DEFAULT_AGENT_NAME,
    url: DEFAULT_AGENT_URL,
    model: "qwen2.5:7b",
    description: "Kubernetes homelab yönetim asistanı",
    tools: [],
  });
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const setOllamaTyping = useGameStore((state) => state.setOllamaTyping);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowAgentDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch agent list from registry
  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${REGISTRY_URL}/agents`);
      if (!res.ok) return;
      const data = await res.json() as { agents: AgentInfo[] };
      if (data.agents && data.agents.length > 0) {
        setAgents(data.agents);
      }
    } catch {
      // Registry unavailable — use default agent only
    }
  }, []);

  useEffect(() => {
    void fetchAgents();
    // Refresh every 30s
    const interval = setInterval(() => void fetchAgents(), 30000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  // SSE streaming send
  const sendMessageSSE = async (userContent: string) => {
    const agentUrl = selectedAgent.url;
    const streamUrl = `${agentUrl}/chat/stream`;

    const assistantMsgId = crypto.randomUUID();
    const assistantMsg: OllamaChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      streaming: true,
      agent: selectedAgent.name,
      model: selectedAgent.model,
      toolCalls: [],
    };
    setMessages((prev) => [...prev, assistantMsg]);

    const toolCallsAccum: ToolCall[] = [];
    let fullText = "";

    try {
      const res = await fetch(streamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userContent,
          session_id: SESSION_ID,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data) as {
              text?: string;
              type?: string;
              tool?: string;
              error?: string;
            };

            if (parsed.error) {
              throw new Error(parsed.error);
            }

            if (parsed.type === "tool_call" && parsed.tool) {
              toolCallsAccum.push({ tool: parsed.tool, result: "" });
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, toolCalls: [...toolCallsAccum] }
                    : m
                )
              );
            } else if (parsed.text) {
              fullText += parsed.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: fullText } : m
                )
              );
            }
          } catch {
            // Skip malformed SSE line
          }
        }
      }

      // Mark streaming done
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, streaming: false } : m
        )
      );
    } catch (streamErr) {
      // SSE failed — fallback to normal /chat
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
      await sendMessageFallback(userContent);
      return;
    }
  };

  // Normal (non-streaming) fallback
  const sendMessageFallback = async (userContent: string) => {
    const agentUrl = selectedAgent.url;

    try {
      const res = await fetch(`${agentUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userContent,
          session_id: SESSION_ID,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json() as {
        response: string;
        backend?: string;
        tool_calls?: ToolCall[];
        model?: string;
        agent?: string;
      };

      const assistantMsg: OllamaChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        backend: data.backend,
        toolCalls: data.tool_calls,
        model: data.model ?? selectedAgent.model,
        agent: data.agent ?? selectedAgent.name,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bağlantı hatası");
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userContent = input.trim();

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
      await sendMessageSSE(userContent);
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

  // All available agents (default + registry)
  const allAgents: AgentInfo[] = [
    { name: DEFAULT_AGENT_NAME, url: DEFAULT_AGENT_URL, model: "qwen2.5:7b", description: "Kubernetes homelab yönetim asistanı", tools: [] },
    ...agents.filter((a) => a.name !== DEFAULT_AGENT_NAME),
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900 flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-base flex-shrink-0">🦙</span>

          {/* Agent selector dropdown */}
          <div className="relative flex-1 min-w-0" ref={dropdownRef}>
            <button
              onClick={() => setShowAgentDropdown((v) => !v)}
              className="flex items-center gap-1 font-bold text-orange-400 uppercase tracking-wider text-[11px] hover:text-orange-300 transition-colors max-w-full"
              title={selectedAgent.description}
            >
              <span className="truncate">{selectedAgent.name}</span>
              <ChevronDown size={10} className={`flex-shrink-0 transition-transform ${showAgentDropdown ? "rotate-180" : ""}`} />
            </button>

            {showAgentDropdown && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-slate-900 border border-slate-700 rounded shadow-xl min-w-[200px] max-w-[280px]">
                {allAgents.map((agent) => (
                  <button
                    key={agent.name}
                    onClick={() => {
                      setSelectedAgent(agent);
                      setShowAgentDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-[11px] hover:bg-slate-800 transition-colors flex flex-col gap-0.5 ${
                      agent.name === selectedAgent.name ? "bg-orange-950/30 text-orange-300" : "text-slate-300"
                    }`}
                  >
                    <span className="font-bold">{agent.name}</span>
                    <span className="text-[9px] text-slate-500">{agent.model} · {agent.description.slice(0, 40)}</span>
                  </button>
                ))}
                <button
                  onClick={() => { void fetchAgents(); setShowAgentDropdown(false); }}
                  className="w-full text-left px-3 py-1.5 text-[10px] text-slate-600 hover:text-slate-400 border-t border-slate-800 transition-colors"
                >
                  ↻ Yenile
                </button>
              </div>
            )}
          </div>

          {isLoading && (
            <span className="text-[10px] text-orange-400 animate-pulse flex-shrink-0">● düşünüyor...</span>
          )}
        </div>

        <button
          onClick={() => setMessages([])}
          className="p-1 text-slate-600 hover:text-slate-400 transition-colors flex-shrink-0"
          title="Sohbeti temizle"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-grow min-h-0 overflow-y-auto p-2 flex flex-col gap-2">
        {messages.length === 0 && (
          <div className="flex-grow flex items-center justify-center text-slate-600 text-[11px] italic text-center px-4">
            {selectedAgent.description}
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
              } ${msg.streaming && !msg.content ? "animate-pulse" : ""}`}
            >
              {msg.content || (msg.streaming ? "▊" : "")}
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

            {/* Agent / model badge */}
            {msg.agent && (
              <span className="text-[9px] px-1.5 py-0.5 rounded text-orange-500 bg-orange-950/30">
                [{msg.agent}] {msg.model ? `· ${msg.model}` : ""}
              </span>
            )}
          </div>
        ))}

        {/* Loading indicator (non-streaming) */}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
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
