# HIXAM-GES

Gestion de stock et de livraison de viande en gros.

| Dossier | Contenu |
|---|---|
| `apps/api` | API NestJS + PostgreSQL (stock par livre de mouvements, lots, roles) |
| `apps/web` | Portail de gestion (React) |
| `apps/mobile` | App livreurs (React Native) - phase 2 |

## Principe
Le stock n'est jamais modifie : il est calcule a partir de mouvements immuables
(reception, transfert, perte). Chaque arrivage cree un lot (date d'abattage, DLC, temperature).

## Deploiement (Coolify)
1. Nouvelle ressource -> Docker Compose depuis ce depot.
2. Variables : voir `.env.example`.
3. Domaine sur le service `web`, port 80.

## Developpement local
```
cd apps/api && npm i && npm run build
PGHOST=... PGUSER=... PGPASSWORD=... PGDATABASE=... JWT_SECRET=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npm start
cd apps/web && npm i && npm run dev   # proxy /api -> localhost:3000
```
