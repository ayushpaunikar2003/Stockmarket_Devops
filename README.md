# StockTradePro — Full-Stack DevOps Project

A portfolio-grade, production-style web application demonstrating a complete DevOps lifecycle:
**GitHub Actions CI/CD → Docker Hub → Helm → Argo CD GitOps → Kubernetes → Prometheus Monitoring & Loki Centralized Logging**

---

## 1. Architecture Overview

```
Developer
    │
    │  git push (branch: ayush)
    ▼
GitHub (Repository: Stockmarket_Devops)
    │
    ▼
GitHub Actions CI/CD (Self-hosted & Ubuntu runners)
    ├── 1. Validate: lint, dependencies, frontend build, syntax
    ├── 2. Test: Jest + Supertest (unit & integration tests, no Mongo needed)
    ├── 3. Security: Hadolint Dockerfile linting & configuration checks
    ├── 4. Docker: Multi-stage build (ARM64) → Trivy CVE Scan → Docker Hub Push
    └── 5. Manifest Update: yq patch helm/stockmarket/values.yaml (Git SHA)
            │
            │  git commit [skip ci]
            ▼
        GitHub (ayush branch)
            │
            ▼
        Argo CD (GitOps Controller — watches helm/stockmarket on ayush)
            │
            ▼
        Helm (renders Kubernetes manifests dynamically)
            │
            ▼
    Kind Kubernetes Cluster (kind-stockmarket)
    ┌────────────────────────────────────────────────────────┐
    │  Namespace: stockmarket                                │
    │                                                        │
    │  ┌──────────────┐     ┌────────────────┐               │
    │  │   Frontend   │────▶│    Backend     │               │
    │  │ (React/Nginx)│     │(Express 4/Node)│               │
    │  │   Port: 80   │     │   Port: 5000   │               │
    │  └──────────────┘     └───────┬────────┘               │
    │                               │                        │
    │                      ┌────────▼────────┐               │
    │                      │     MongoDB     │               │
    │                      │   Port: 27017   │               │
    │                      └─────────────────┘               │
    └────────────────────────────────────────────────────────┘

    Observability & Logging Stack (Docker / Kind network)
    ┌────────────────────────────────────────────────────────┐
    │  Prometheus (:9090) ◄── Scrapes Backend /metrics       │
    │  cAdvisor   (:8082) ◄── Container metrics (CPU/RAM)    │
    │  Node Exp   (:9100) ◄── Host hardware metrics          │
    │  Promtail   (:9080) ◄── Discovers container log streams│
    │       │                                                │
    │       ▼                                                │
    │  Loki       (:3100) ◄── High-performance TSDB indexing │
    │       │                                                │
    │       ▼                                                │
    │  Grafana    (:3001) ◄── Unified Dashboards (admin/123) │
    └────────────────────────────────────────────────────────┘
```

---

## 2. Project Structure

```
Stockmarket_Devops/
├── .github/workflows/
│   └── ci.yml                   # 5-stage GitHub Actions CI/CD pipeline
├── app/
│   ├── backend/
│   │   ├── Dockerfile            # node:20-alpine, production dependencies only
│   │   ├── server.js             # Express app (modular, exports app for tests)
│   │   ├── routes/contactRoutes.js # REST API routes
│   │   ├── models/Contact.js     # Mongoose schema
│   │   └── __tests__/health.test.js # Jest + Supertest automated tests
│   └── frontend/
│       ├── Dockerfile            # Multi-stage: node:20 build → nginx:1.27-alpine
│       ├── nginx.conf            # SPA routing + /api reverse proxy to backend
│       └── src/                  # React Single Page Application
├── helm/
│   └── stockmarket/
│       ├── Chart.yaml            # Helm chart metadata
│       ├── values.yaml           # Configurable values (images, replicas, probes)
│       └── templates/
│           ├── backend/          # Deployment + Service (with liveness/readiness)
│           ├── frontend/         # Deployment + Service (NodePort 30080)
│           └── mongo/            # Deployment + Service (with mongosh ping probes)
├── argocd/
│   └── stockmarket-app.yaml      # Argo CD Application manifest (automated sync & heal)
├── docker/
│   └── docker-compose.yml        # Local multi-container development stack
├── logging/
│   ├── loki/
│   │   └── loki-config.yml       # Loki TSDB filesystem storage configuration
│   └── promtail/
│       └── promtail-config.yml   # Docker socket auto-discovery container logging
├── monitoring/
│   ├── docker-compose.monitoring.yml # Prometheus + Grafana + Loki + Promtail + cAdvisor
│   ├── prometheus/prometheus.yml # Prometheus scrape targets & intervals
│   └── grafana/
│       ├── provisioning/
│       │   ├── datasources/datasource.yml # Auto-provisioned Prometheus & Loki
│       │   └── dashboards/dashboard.yml   # Dashboard loader
│       └── dashboards/
│           ├── stockmarket-dashboard.json # Application metrics & health
│           ├── logging-dashboard.json     # Centralized Loki logs dashboard
│           ├── docker-containers.json     # Container CPU, memory, and restart metrics
│           └── node-exporter-full.json    # Linux system performance
├── security/
│   ├── trivy-config.yml          # Trivy vulnerability scanner configuration
│   └── trivy-scan.sh             # Local security scan helper script
├── check-monitoring.sh           # Automated Prometheus health evaluation script
└── README.md                     # Comprehensive project documentation
```

---

## 3. Prerequisites

- **Docker Engine** & **Docker Compose** (v2.20+)
- **Kubernetes CLI (`kubectl`)**
- **Helm 3** (`helm version`)
- **Kind** (Kubernetes in Docker, v0.20+)
- **Node.js 20+** & **npm** (for local development/testing)
- **Git**

---

## 4. Local Docker Execution

For local testing without Kubernetes:

```bash
# 1. Create Docker network (once)
docker network create stockmarket-network

# 2. Launch application stack
docker compose -f docker/docker-compose.yml up -d

# 3. Access local endpoints:
#    Frontend:  http://localhost:3000
#    Backend:   http://localhost:5001/health
#    MongoDB:   localhost:27017

# 4. Stop stack
docker compose -f docker/docker-compose.yml down
```

---

## 5. Kubernetes Deployment

The project runs in a local Kind cluster named `kind-stockmarket` under namespace `stockmarket`.

```bash
# Set context
kubectl config use-context kind-stockmarket

# Verify namespace
kubectl get ns stockmarket

# Verify application pods and services
kubectl get pods,svc,deployments -n stockmarket -o wide

# Check pod logs
kubectl logs -l app=backend -n stockmarket --tail=50
kubectl logs -l app=frontend -n stockmarket --tail=50
kubectl logs -l app=mongo -n stockmarket --tail=50
```

---

## 6. Helm Commands

The application is packaged into a Helm chart at `helm/stockmarket`:

```bash
# Lint the chart
helm lint helm/stockmarket

# Render templates locally (dry-run)
helm template stockmarket helm/stockmarket --namespace stockmarket

# Manually install or upgrade chart
helm upgrade --install stockmarket helm/stockmarket \
  --namespace stockmarket --create-namespace

# View active release values
helm get values stockmarket -n stockmarket

# View release history
helm history stockmarket -n stockmarket
```

### Configurable Values (`helm/stockmarket/values.yaml`):

| Key | Description | Default |
|-----|-------------|---------|
| `backend.replicaCount` | Backend replica count | `2` |
| `backend.image.repository` | Docker Hub backend repository | `dockerayush13/stockmarket-backend` |
| `backend.image.tag` | Target image tag (Git SHA) | Commit SHA |
| `backend.resources` | CPU/Memory requests & limits | `100m/128Mi` to `500m/256Mi` |
| `frontend.replicaCount` | Frontend replica count | `1` |
| `frontend.image.repository` | Docker Hub frontend repository | `dockerayush13/stockmarket-frontend` |
| `frontend.service.nodePort` | Exposed node port | `30080` |
| `mongo.replicaCount` | Database replica count | `1` |

---

## 7. Argo CD Setup (GitOps)

Argo CD manages GitOps synchronization continuously:

- **Application Name**: `stockmarket`
- **Tracked Branch**: `ayush`
- **Path**: `helm/stockmarket`
- **Repository**: `https://github.com/ayushpaunikar2003/Stockmarket_Devops.git`

```bash
# Check Argo CD Application sync & health
kubectl get application stockmarket -n argocd

# Trigger manual immediate sync
kubectl -n argocd patch app stockmarket \
  -p '{"operation":{"sync":{}}}' --type merge

# Access Argo CD Web UI (Port-forward)
kubectl port-forward svc/argocd-server -n argocd 8080:443 &
# Open: https://localhost:8080
# Fetch initial admin password:
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d && echo
```

---

## 8. GitHub Actions Explanation

The automated pipeline in `.github/workflows/ci.yml` consists of five sequential jobs:

```
validate ──▶ test ──▶ security ──▶ docker (build + Trivy + push) ──▶ update-manifests
```

1. **`validate`** (runs on `ubuntu-latest`):
   - Sets up Node.js 20 with npm caching.
   - Installs dependencies and runs `npm run build` on frontend.
   - Validates backend syntax with `node --check server.js`.

2. **`test`** (runs on `ubuntu-latest`, needs `validate`):
   - Installs backend dependencies.
   - Executes automated unit and integration tests using `npm test` (Jest + Supertest).
   - Validates `/health`, `/`, `/metrics`, and `/api/contact`.

3. **`security`** (runs on `ubuntu-latest`, needs `test`):
   - Runs Hadolint against `app/backend/Dockerfile` and `app/frontend/Dockerfile`.
   - Ensures best practices (non-root recommendations, cache management, pinning).

4. **`docker`** (runs on `self-hosted` ARM64 runner, needs `security`):
   - Builds `stockmarket-backend` and `stockmarket-frontend` images.
   - Runs Trivy vulnerability scanner on both images (blocks on CRITICAL vulnerabilities).
   - Logs into Docker Hub using `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`.
   - Pushes both images tagged with the immutable `${{ github.sha }}`.

5. **`update-manifests`** (runs on `ubuntu-latest`, needs `docker`):
   - Checks out the `ayush` branch.
   - Uses `yq` to update `backend.image.tag` and `frontend.image.tag` in `helm/stockmarket/values.yaml`.
   - Commits with message `"chore: update images to <sha> [skip ci]"` and pushes back to `origin ayush`.
   - Argo CD detects the commit and triggers automated deployment to Kubernetes.

---

## 9. Docker Hub Images

All production images are built with immutable Git commit SHA tags:

- **Backend**: `docker.io/dockerayush13/stockmarket-backend:<git-sha>`
- **Frontend**: `docker.io/dockerayush13/stockmarket-frontend:<git-sha>`

To inspect running image tags in Kubernetes:
```bash
kubectl get pods -n stockmarket -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[*].image}{"\n"}{end}'
```

---

## 10. Prometheus Monitoring

Prometheus runs on port `9090` and scrapes metrics every 15 seconds:

- **Backend `/metrics`**: Node.js event-loop, process memory, active HTTP requests, duration histogram (`http_request_duration_seconds`), and status codes.
- **Node Exporter**: Host CPU, memory usage, disk I/O, network traffic.
- **cAdvisor**: Container-level resource usage (CPU seconds, memory resident, network RX/TX).

Verify scrape status:
```bash
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'
```

---

## 11. Grafana

Grafana runs on port `3001` with pre-configured datasources and provisioned dashboards:

- **URL**: `http://localhost:3001`
- **Default Credentials**: `admin` / `admin123`
- **Datasources**:
  - `Prometheus` (default metrics source)
  - `Loki` (centralized log aggregation source)

### Available Dashboards:
1. **StockMarket Monitoring**: HTTP request rate, 4xx/5xx error rates, P95 latency, backend health.
2. **StockMarket Logging & Observability**: Real-time log streams, error filtering, component breakdowns.
3. **Docker Containers / cAdvisor**: Container CPU, memory usage, restart counts.
4. **Node Exporter Full**: Linux host telemetry and hardware utilization.

---

## 12. Loki Centralized Logging

Loki runs on port `3100` as a lightweight, single-binary log indexing engine using local filesystem TSDB storage.

- **Listen Port**: `3100`
- **Health Endpoint**: `http://localhost:3100/ready`
- **Labels Endpoint**: `http://localhost:3100/loki/api/v1/labels`
- **Indexed Labels**: `container`, `app`, `job`, `stream`

Example LogQL Queries in Grafana:
```logql
# Stream backend logs
{container="stockmarket-backend"}

# Stream frontend/nginx access logs
{container="stockmarket-frontend"}

# Filter error logs across all containers
{job=~".+"} |~ "(?i)(error|failed|exception|500)"

# Log rate per container
sum by (container) (rate({job=~".+"}[1m]))
```

---

## 13. Promtail

Promtail acts as the log shipper. It connects to the Docker socket `/var/run/docker.sock`, automatically detects running containers, extracts logs, labels them with container metadata, and streams them into Loki via `http://loki:3100/loki/api/v1/push`.

---

## 14. Logging Architecture

```
[stockmarket-backend]    ──┐
[stockmarket-frontend]   ──┼─▶ /var/run/docker.sock ──▶ Promtail (:9080)
[stockmarket-mongo]      ──┤                                │
[stockmarket-control]    ──┘                                ▼
                                                       Loki (:3100)
                                                            │
                                                            ▼
                                                       Grafana (:3001)
```

---

## 15. Monitoring Architecture

```
Application Pods / Containers
       │
       ├── Express Backend (/metrics via prom-client) ──┐
       ├── cAdvisor (/metrics container level)         ──┼─▶ Prometheus (:9090)
       └── Node Exporter (/metrics host level)         ──┘        │
                                                                  ▼
                                                             Grafana (:3001)
```

---

## 16. CI/CD Flow

```
1. Developer edits code & runs `git push origin ayush`
2. GitHub Actions triggers `validate` (build test) & `test` (Jest tests)
3. `security` executes Dockerfile linting (Hadolint)
4. `docker` builds images on ARM64 self-hosted runner
5. `docker` executes Trivy CVE vulnerability scans
6. `docker` pushes images tagged with Git SHA to Docker Hub
7. `update-manifests` patches `helm/stockmarket/values.yaml` and commits with `[skip ci]`
8. Argo CD detects Git change in repository
9. Argo CD executes rolling deployment to Kind Kubernetes cluster
```

---

## 17. GitOps Flow

Argo CD operates on the pull-based GitOps model:
- Desired state is declaratively defined in Git (`helm/stockmarket`).
- Actual state is running in Kubernetes (`stockmarket` namespace).
- If Git changes, Argo CD syncs automatically (`prune: true, selfHeal: true`).
- If an admin modifies cluster resources directly, Argo CD detects drift and self-heals back to the Git state.

---

## 18. Health Checks & Probes

| Component | Probe Type | Mechanism | Interval |
|-----------|------------|-----------|----------|
| Backend | Liveness | HTTP GET `/health` on port 5000 | 20s |
| Backend | Readiness | HTTP GET `/health` on port 5000 | 10s |
| Frontend | Liveness | HTTP GET `/` on port 80 | 20s |
| Frontend | Readiness | HTTP GET `/` on port 80 | 10s |
| MongoDB | Liveness | Exec `mongosh --eval "db.adminCommand('ping')"` | 20s |
| MongoDB | Readiness | Exec `mongosh --eval "db.adminCommand('ping')"` | 10s |

---

## 19. Troubleshooting Guide

| Symptom | Probable Cause | Diagnostic Command / Solution |
|---------|----------------|-------------------------------|
| Argo CD OutOfSync | New commit waiting for sync window | Run `kubectl -n argocd patch app stockmarket -p '{"operation":{"sync":{}}}' --type merge` |
| Pod `ImagePullBackOff` | Docker Hub rate limit or wrong SHA | Check tag: `kubectl describe pod -l app=backend -n stockmarket` |
| Backend Pod CrashLoopBackOff | MongoDB not reachable | Inspect logs: `kubectl logs -l app=backend -n stockmarket` |
| Frontend displays 502 Bad Gateway | Backend service down or unresponsive | Verify backend: `kubectl get endpoints backend -n stockmarket` |
| Jest tests timeout | Open handles in test suite | Ensure `jest --forceExit` is set in `package.json` |
| Prometheus targets down | Scrape target hostname mismatch | Check targets in `monitoring/prometheus/prometheus.yml` |
| Loki reports permission denied | Volume directory owned by root | Ensure `user: "root"` or appropriate UID permissions in compose |

---

## 20. Safe Rollback Procedure

### Option 1: Git-Driven Rollback (Recommended)
```bash
# 1. Identify previous working commit
git log -n 5 --oneline

# 2. Revert the image-tag commit
git revert HEAD --no-edit

# 3. Push to trigger Argo CD sync
git push origin ayush
```

### Option 2: Helm Release Rollback
```bash
# 1. View revision history
helm history stockmarket -n stockmarket

# 2. Rollback to desired revision
helm rollback stockmarket <revision-number> -n stockmarket
```

### Option 3: Argo CD UI / CLI Rollback
In Argo CD Web UI: Select `stockmarket` Application → **History and Rollback** → Select previous deployment → Click **Rollback**.

---

## 21. Useful `kubectl` Commands

```bash
# View all stockmarket pods with IP and node
kubectl get pods -n stockmarket -o wide

# Describe deployment rollout status
kubectl rollout status deployment/backend -n stockmarket

# Stream logs from all backend replicas
kubectl logs -f -l app=backend -n stockmarket

# Port forward frontend service to port 8080
kubectl port-forward svc/frontend 8080:80 -n stockmarket

# Execute smoke test pod inside cluster
kubectl run smoke --rm -i --restart=Never --image=curlimages/curl -- \
  curl -s http://backend.stockmarket.svc.cluster.local:5000/health
```

---

## 22. Useful `helm` Commands

```bash
# Lint the chart
helm lint helm/stockmarket

# Render templates with custom tag
helm template stockmarket helm/stockmarket --set backend.image.tag=latest

# Check chart release status
helm status stockmarket -n stockmarket
```

---

## 23. Useful `docker` Commands

```bash
# View active monitoring stack
docker compose -f monitoring/docker-compose.monitoring.yml ps

# Restart Loki and Promtail
docker compose -f monitoring/docker-compose.monitoring.yml restart loki promtail

# View live container log stream from Promtail
docker logs -f promtail
```

---

## 24. Useful `git` Commands

```bash
# Check working tree status
git status

# View commit history
git log -n 10 --graph --oneline --decorate

# Verify remote branches
git remote -v
```
