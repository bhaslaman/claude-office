# Son Oturum Durumu

**Son Güncelleme:** 2026-02-28 (Oturum 2)

---

## Hızlı Başlangıç

```bash
# Pod durumu
kubectl get pods -n ai-consul
kubectl get pods -n infra
kubectl get pods -n local-llm

# claude-office başlat
cd ~/haslaman-lab/claude-office
PATH="/opt/homebrew/bin:/Users/burak/.local/bin:$PATH" make backend   # port 8000
# → http://localhost:8000  (🦙 OLLAMA tab'ı mevcut!)

# Vault restart sonrası (gerekirse)
~/ai-consul/infra/vault/init-secrets.sh
```

---

## Geçmiş Oturumlar

- `logs/2026-02-28.md` — Ollama Terminal + Sprite implementasyonu
- (öncesi: SESSION.md tek dosya olarak tutuluyordu)

---

## 2026-02-28 Oturum 1 — k8s Altyapısı ✅

### Proje Yeniden Adlandırma
- `haslaman-lab` → **ai-consul**
- Repo: https://github.com/bhaslaman/ai-consul (private)
- Lokal: `~/ai-consul/`
- gh CLI: `/opt/homebrew/bin/gh`

### k8s Servisleri (Docker Desktop)

**Namespace: ai-consul**

| Servis | URL | Açıklama |
|--------|-----|----------|
| claude-office-backend | http://localhost:8000 | FastAPI + static UI ✅ |
| claude-office-frontend | http://localhost:30300 | Next.js dev (ERR_EMPTY_RESPONSE problemi var) |
| claude-gateway | http://localhost:30899 | Claude CLI wrapper `POST /chat` |
| consul-backend | http://localhost:30801 | AI Consul WebSocket backend |
| mcp-atlassian | http://localhost:30900 | Jira MCP |
| homelab-agent | http://localhost:30802 | Ollama+Claude k8s yönetim asistanı ✅ |

**Namespace: local-llm**

| Servis | URL | Açıklama |
|--------|-----|----------|
| Ollama | http://ollama.local-llm.svc.cluster.local:11434 | LLM inference (cluster içi) |

**Namespace: infra**

| Servis | URL | Kullanıcı | Şifre |
|--------|-----|-----------|-------|
| Consul UI | http://localhost:30850 | — | — |
| Vault UI | http://localhost:30821 | — | `root` |
| ArgoCD UI | http://localhost:30080 | admin | `admin123` |

### Helm

```bash
helm upgrade ai-consul ~/ai-consul/charts/ai-consul/ --namespace ai-consul
helm list --all-namespaces
```

| Release | Namespace | Chart |
|---------|-----------|-------|
| ai-consul | ai-consul | local 0.1.0 |
| vault | infra | hashicorp/vault 0.32.0 |
| consul | infra | hashicorp/consul 1.9.3 |
| argocd | infra | argo/argo-cd |

### Vault Secrets
- `secret/ai-consul/jira` → url, username, api-token
- `secret/ai-consul/claude` → credentials
- `secret/argocd/github` → GitHub PAT
- Policy: `ai-consul-policy`, `argocd-policy`
- Role: `ai-consul` (default SA, ai-consul ns), `argocd` (infra ns)

### ArgoCD
- GitHub `bhaslaman/ai-consul` izleniyor, otomatik sync aktif (prune + selfHeal)
- Application: `charts/ai-consul/` → `ai-consul` namespace
- **git push → otomatik deploy** ✅

---

## 2026-02-28 Oturum 2 — Ollama Terminal + Sprite ✅

### claude-office'e Eklenenler
- **OllamaSprite** — canvas x=960 y=880, turuncu karakter, typing animasyonu
- **OllamaTerminal** — sağ sidebar `🦙 OLLAMA` tab'ı
  - `localhost:30802/chat` → homelab-agent
  - Tool call badge'leri, backend göstergesi
- **gameStore** — `ollamaIsTyping` state
- **positions** — `OLLAMA_DESK_POSITION`
- **homelab-agent** — CORS middleware eklendi → push ✅ → ArgoCD deploy

### Commit Durumu
| Repo | Commit | Push |
|------|--------|------|
| ai-consul | `411f6f7` CORS | ✅ |
| claude-office | `55e1797` Ollama | ❌ (fork yok) |

---

## Yapılacaklar — Öncelik Sırası

### 🔴 Acil (Bir Sonraki Oturumda)
- [ ] `claude-office` GitHub fork oluştur → `bhaslaman/claude-office`
- [ ] `git remote add fork https://github.com/bhaslaman/claude-office.git && git push fork main`
- [ ] ArgoCD'ye claude-office fork'u ekle
- [ ] OllamaTerminal testi: mesaj gönder, sprite animasyonu doğrula

### 🟡 Kısa Vadeli
- [ ] `claude-office-frontend` (30300) ERR_EMPTY_RESPONSE → static build'e geç
- [ ] Mac Mini node_exporter → launchd kalıcı
- [ ] Proxmox DNS kalıcı
- [ ] `~/.zshrc`'ye PATH ekle
- [ ] `git config --global user.name/email` ayarla

### 🟢 Orta Vadeli
- [ ] Windows Ollama CUDA kurulumu (RTX 4060)
- [ ] Open WebUI kurulumu
- [ ] OllamaTerminal stream desteği (SSE)
- [ ] Nginx reverse proxy (homelab-services VM)
- [ ] Teams MCP kurulumu
- [ ] Grafana dashboard görünürlük sorunu

### 🔵 Uzun Vadeli
- [ ] macOS/iOS/watchOS native Swift app (AI Consul Agent)
- [ ] k8s DNS ingress-nginx kurulumu
- [ ] Vault prod modu (persistent storage, TLS)
- [ ] CI/CD pipeline (GHCR)

---

## Önemli Dosyalar

| Dosya | İçerik |
|-------|--------|
| `~/ai-consul/ai-consul_erisim-info.md` | Tüm URL/port/kullanıcı/şifre |
| `~/ai-consul/infra/vault/init-secrets.sh` | Vault restart script |
| `~/Claude-Sohbet/homelab_project.md` | Cihaz envanteri + mimari |
| `~/Claude-Sohbet/logs/` | Günlük session logları |

---

## Repo Durumu

| Repo | Branch | Son Commit | Push |
|------|--------|------------|------|
| `~/ai-consul` | main | `411f6f7` CORS | ✅ origin |
| `~/haslaman-lab/claude-office` | main | `55e1797` Ollama | ✅ local only |

---

## Önemli PATH Notu

```bash
eval "$(/opt/homebrew/bin/brew shellenv)"
export PATH="$HOME/.local/bin:$PATH"
```
~/.zshrc'ye henüz eklenmedi.
