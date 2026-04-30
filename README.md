# HYD Flight Tracker

Live flight tracking dashboard for Hyderabad airspace. Shows real-time ADS-B flight positions, routes, and live METAR weather for RGIA (VOHS/HYD). No API keys required.

---

## Project structure

```
.
├── server.js
├── package.json
├── public/
│   └── index.html
├── docker/
│   ├── Dockerfile
│   └── .dockerignore
├── k8-configs/
│   ├── config.yaml        # Deployment with resource limits
│   ├── hpa.yaml           # HorizontalPodAutoscaler (CPU-based)
│   └── loadbalancer.yaml  # LoadBalancer service on port 80
├── .gitignore
└── README.md
```

---

## 1. Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

---

## 2. Build Docker image

Run from the project root — build context must be here, not inside `docker/`:

```bash
docker build -f docker/Dockerfile -t siddhantgahtori/do-assessment:latest .
```

---

## 3. Push to Docker Hub

```bash
docker login
docker push siddhantgahtori/do-assessment:latest
```

---

## 4. Deploy to DigitalOcean Kubernetes (DOKS)

### Step 1 — Connect kubectl to the cluster

```bash
doctl kubernetes cluster kubeconfig save <your-cluster-name>
```

Verify the connection:

```bash
kubectl get nodes
```

### Step 2 — Apply the Deployment

```bash
kubectl apply -f k8-configs/config.yaml
```

Check it rolled out:

```bash
kubectl get deployment flights-hyd
kubectl get pods
```

### Step 3 — Apply the LoadBalancer service

```bash
kubectl apply -f k8-configs/loadbalancer.yaml
```

Wait for the external IP to be assigned (takes ~60 seconds on DOKS):

```bash
kubectl get svc primary-lb
```

The app is reachable on port 80 of that external IP.

### Step 4 — Apply the HPA

```bash
kubectl apply -f k8-configs/hpa.yaml
```

Verify it is attached and reading metrics:

```bash
kubectl get hpa flights-hyd
kubectl describe hpa flights-hyd
```

The HPA scales the deployment between 1 and 3 replicas when CPU crosses 70% of the requested 50m.
