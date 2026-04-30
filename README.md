# HYD Flight Tracker

Live flight tracking dashboard for Hyderabad airspace — ADS-B positions, METAR weather, DigitalOcean-themed UI. No API keys required.

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
│   ├── config.yaml        # Deployment (resource limits + CPU request)
│   ├── hpa.yaml           # HorizontalPodAutoscaler (CPU-based, 70%)
│   └── loadbalancer.yaml  # LoadBalancer service on port 80
├── .gitignore
└── README.md
```

---

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

---

## Build & push Docker image

Build context must be the project root:

```bash
docker build -f docker/Dockerfile -t siddhantgahtori/do-assessment:latest .
docker push siddhantgahtori/do-assessment:latest
```

---

## Deploy to DOKS

**1. Connect kubectl to your cluster**
```bash
doctl kubernetes cluster kubeconfig save <your-cluster-name>
```

**2. Apply all manifests**
```bash
kubectl apply -f k8-configs/
```

**3. Get the LoadBalancer IP**
```bash
kubectl get svc primary-lb
```

App is available on port 80 of the external IP.

---

## Test HPA

```bash
# Scale up first if replicas are 0
kubectl scale deployment flights-hyd --replicas=1

# Run a load generator
kubectl run load-gen --image=busybox --restart=Never \
  -- /bin/sh -c "while true; do wget -q -O- http://primary-lb/api/flights; done"

# Watch HPA react
kubectl get hpa flights-hyd -w

# Clean up
kubectl delete pod load-gen
```
