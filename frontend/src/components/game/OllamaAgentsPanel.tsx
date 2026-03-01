/**
 * OllamaAgentsPanel Component
 *
 * Shows all registered homelab agents with health status.
 * - Fetches from agent-registry :30810 every 30s
 * - Health check per agent via /health endpoint
 * - Card layout: name, model, description, health dot, tool count
 */

"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

interface AgentInfo {
  name: string;
  url: string;
  model: string;
  description: string;
  tools: string[];
  healthy?: boolean;
}

const REGISTRY_URL = "http://localhost:30810";

// Cluster-internal URL → browser NodePort URL mapping
const AGENT_EXTERNAL_URLS: Record<string, string> = {
  "manager-agent":        "http://localhost:30814",
  "devops-agent":         "http://localhost:30802",
  "coder-agent":          "http://localhost:30803",
  "noc-agent":            "http://localhost:30804",
  "product-owner-agent":  "http://localhost:30805",
  "network-system-agent": "http://localhost:30807",
  "tester-agent":         "http://localhost:30816",
  "security-agent":       "http://localhost:30817",
};

const DEFAULT_AGENTS: AgentInfo[] = [
  {
    name: "manager-agent",
    url: "http://localhost:30814",
    model: "qwen2.5:14b",
    description: "Ekip orkestratörü — görevi doğru agent'a yönlendirir",
    tools: [],
  },
];

export function OllamaAgentsPanel(): ReactNode {
  const [agents, setAgents] = useState<AgentInfo[]>(DEFAULT_AGENTS);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAgents = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // /agents/health: registry does server-side health checks via cluster-internal URLs
      const res = await fetch(`${REGISTRY_URL}/agents/health`);
      if (!res.ok) {
        setAgents((prev) => prev.map((a) => ({ ...a, healthy: false })));
        return;
      }
      const data = await res.json() as { agents: (AgentInfo & { healthy: boolean })[] };
      const list = data.agents?.length > 0 ? data.agents : DEFAULT_AGENTS;
      // Remap cluster-internal URLs to browser-accessible NodePort URLs
      const mapped = list.map((a) => ({
        ...a,
        url: AGENT_EXTERNAL_URLS[a.name] ?? a.url,
      }));
      setAgents(mapped);
      setLastUpdated(new Date());
    } catch {
      // Registry unavailable — keep defaults, mark unhealthy
      setAgents(DEFAULT_AGENTS.map((a) => ({ ...a, healthy: false })));
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchAgents();
    const interval = setInterval(() => void fetchAgents(), 30000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  const healthyCount = agents.filter((a) => a.healthy).length;

  return (
    <div className="flex flex-col h-full bg-slate-950 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base flex-shrink-0">🤖</span>
          <span className="font-bold text-orange-400 uppercase tracking-wider text-[11px]">
            AGENTS
          </span>
          <span className="text-[10px] text-slate-500">
            {healthyCount}/{agents.length} sağlıklı
          </span>
        </div>
        <button
          onClick={() => void fetchAgents()}
          disabled={isRefreshing}
          className="p-1 text-slate-600 hover:text-slate-400 transition-colors disabled:opacity-40"
          title="Yenile"
        >
          <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Agent cards */}
      <div className="flex-grow min-h-0 overflow-y-auto p-2 flex flex-col gap-2">
        {agents.map((agent) => (
          <div
            key={agent.name}
            className={`rounded-lg border px-3 py-2 flex flex-col gap-1 transition-colors ${
              agent.healthy
                ? "bg-orange-950/20 border-orange-700/30"
                : agent.healthy === false
                ? "bg-slate-900 border-slate-700/50 opacity-60"
                : "bg-slate-900 border-slate-700/30"
            }`}
          >
            {/* Name + health */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    agent.healthy === true
                      ? "bg-green-400"
                      : agent.healthy === false
                      ? "bg-red-500"
                      : "bg-slate-600"
                  }`}
                />
                <span className="font-bold text-orange-300 truncate">{agent.name}</span>
              </div>
              {agent.tools.length > 0 && (
                <span className="text-[9px] text-slate-500 flex-shrink-0">
                  {agent.tools.length} araç
                </span>
              )}
            </div>

            {/* Model */}
            <div className="text-[10px] text-slate-400">{agent.model}</div>

            {/* Description */}
            <div className="text-[10px] text-slate-500 leading-relaxed">
              {agent.description}
            </div>

            {/* Tools list (if any) */}
            {agent.tools.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {agent.tools.slice(0, 6).map((tool) => (
                  <span
                    key={tool}
                    className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-[9px] text-slate-400"
                  >
                    {tool}
                  </span>
                ))}
                {agent.tools.length > 6 && (
                  <span className="px-1 py-0.5 text-[9px] text-slate-600">
                    +{agent.tools.length - 6}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {agents.length === 0 && (
          <div className="flex-grow flex items-center justify-center text-slate-600 text-[11px] italic">
            Agent bulunamadı
          </div>
        )}
      </div>

      {/* Footer */}
      {lastUpdated && (
        <div className="flex-shrink-0 px-3 py-1.5 border-t border-slate-800 text-[9px] text-slate-700">
          Son güncelleme: {lastUpdated.toLocaleTimeString("tr-TR")}
        </div>
      )}
    </div>
  );
}
