# Les piges radio - Vocast

Bibliothèque « type INA » des radios françaises : enregistrement **heure par heure** (~250 radios, nationales, locales et associatives), écoute en ligne, téléchargement et extraction d'extraits. Rétention 30 jours glissants, stockage [Pixeldrain](https://pixeldrain.com).

Projet [Vocast](https://vocast.fr).

## Architecture

```
apps/
  recorder   Node/TS + ffmpeg : capture les flux (MP3/AAC/HLS) en continu, découpe pile
             aux heures d'horloge, reconstitue les heures en cas de coupure, upload
             Pixeldrain, purge > 30 j, remonte la santé des flux en base
  api        Fastify : radios, piges, proxy audio avec Range (seek + extraction),
             admin sécurisé JWT (CRUD radios, test de flux, santé/couverture)
  web        React Router 7 (SSR) + Tailwind : piges.vocast.fr — player optimisé
             desktop/mobile, extraction d'extraits côté client, PWA, SEO
  admin      React SPA + nginx : gestion des radios, visibilité des flux en panne
packages/
  db         Drizzle ORM + PostgreSQL (schéma, migrations, seed)
  shared     Types partagés
data/
  radios.json  Seed des radios (catégories A associative / B locale indé /
               C locale réseau national / D nationale)
```

**Flux de données** : `recorder` écrit les heures terminées sur Pixeldrain et les métadonnées en base → `api` les sert → `web`/`admin` les consomment. L'audio passe par le proxy `GET /api/recordings/:id/audio` (Range) : le player peut seeker et l'extraction côté client télécharge uniquement la plage d'octets voulue.

### Résilience de l'enregistrement

- ffmpeg avec `-segment_atclocktime` : découpe exacte aux heures pleines, `-reconnect` pour les micro-coupures HTTP ;
- coupure du flux → redémarrage (backoff exponentiel 5 s → 5 min) ; chaque redémarrage écrit une nouvelle « part », l'heure est reconstituée par concaténation (sans ré-encodage) avec un taux de complétude stocké en base ;
- watchdog : un flux qui ne produit plus d'octets pendant 90 s est tué et relancé ;
- flux mort (10 échecs consécutifs) → statut `down`, retry espacé à 15 min (pas de boucle folle), événement visible dans l'admin ;
- backlog automatique : si l'upload Pixeldrain échoue, les parts restent sur disque et sont retentées toutes les 5 min (12 tentatives max) ; garde-fou d'espace disque ;
- rotation hebdomadaire entre plusieurs comptes Pixeldrain (`PIXELDRAIN_API_KEYS` séparées par des virgules), purge quotidienne > `RETENTION_DAYS` sur tous les comptes.

## Démarrage local

Prérequis : Node ≥ 22, pnpm 9 (`corepack enable`), PostgreSQL, ffmpeg (pour le recorder).

```bash
pnpm install
cp .env.example .env            # renseigner DATABASE_URL, etc.

pnpm db:migrate                 # applique les migrations
pnpm db:seed                    # charge data/radios.json (upsert par slug)

pnpm dev:api                    # API sur :3000 (migre + seed aussi au boot)
pnpm dev:web                    # front public sur :3001
pnpm dev:admin                  # admin sur :3002
pnpm dev:recorder               # enregistreur (nécessite ffmpeg + clés Pixeldrain)
```

Vérifications : `pnpm typecheck` et `pnpm build`.

## Données radios

- `data/radios.json` : seed initial (~180 radios). **Les URLs de flux sont "best effort"** : certaines auront changé. Le tableau de bord admin les détecte (statut `down`, bouton *tester*) et permet de les corriger.
- `pnpm scrape:radios` : régénère une liste depuis [fluxradios.blogspot.com](https://fluxradios.blogspot.com/p/flux-radios-francaise.html) (à lancer depuis votre machine, le domaine peut être bloqué dans certains environnements). Produit `data/radios.scraped.json` à relire puis fusionner dans `data/radios.json`.
- Le seed est un **upsert par slug** relançable sans risque : il ne touche jamais aux colonnes gérées en admin (URL de flux, activation…) d'une radio existante.

## Déploiement sur Scaleway avec Coolify

### 1. Préparer l'instance

Une instance Scaleway (Ubuntu 22.04+) avec **8 Go de RAM minimum** (250 ffmpeg simultanés ≈ 4-5 Go) et **50 Go de disque** pour le tampon d'enregistrement (~30 Go de pointe). Ouvrir les ports 80/443 (+ 8000 pour l'UI Coolify le temps de l'installation).

```bash
ssh root@<ip-instance>
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Ouvrir `http://<ip-instance>:8000`, créer le compte admin.

### 2. Connecter GitHub

Coolify → **Sources** → *GitHub App* → suivre l'assistant (installer l'app GitHub sur `Vocast-fr/Vocazap`). C'est ce qui donne le déploiement automatique à chaque push.

### 3. Créer le projet

1. **Projects** → *New Project* → « piges-radio ».
2. *New Resource* → **Docker Compose** → choisir le dépôt `Vocast-fr/Vocazap`, branche `monorepo` (ou `master` après merge). Coolify lit `docker-compose.yml` et détecte les 5 services (`db`, `api`, `recorder`, `web`, `admin`).
3. Renseigner les variables d'environnement (onglet *Environment Variables*) :

| Variable | Exemple |
|---|---|
| `POSTGRES_PASSWORD` | (long mot de passe aléatoire) |
| `PIXELDRAIN_API_KEYS` | `clé1,clé2` (une par compte Pixeldrain) |
| `JWT_SECRET` | (longue chaîne aléatoire) |
| `ADMIN_PASSWORD` | mot de passe de l'admin |
| `PUBLIC_API_URL` | `https://api.piges.vocast.fr` |
| `PUBLIC_WEB_URL` | `https://piges.vocast.fr` |
| `CORS_ORIGINS` | `https://piges.vocast.fr,https://admin.piges.vocast.fr` |

4. Assigner les domaines (onglet *Domains* de chaque service) :
   - `web` → `https://piges.vocast.fr` (port 3000)
   - `api` → `https://api.piges.vocast.fr` (port 3000)
   - `admin` → `https://admin.piges.vocast.fr` (port 80)

   Créer les 3 enregistrements DNS `A` vers l'IP de l'instance ; Coolify obtient les certificats Let's Encrypt automatiquement.
5. **Deploy**. Au premier boot : l'API applique les migrations et seed `data/radios.json`, le recorder démarre l'enregistrement de toutes les radios actives.

### 4. CI/CD

- **CD** : Coolify redéploie à chaque push sur la branche configurée (webhook GitHub App). `git push` = mise en prod.
- **CI** : `.github/workflows/ci.yml` (typecheck + build de tout le monorepo) tourne sur chaque push/PR. Pour ne déployer qu'après CI verte, décommenter le job `deploy` du workflow et déclencher Coolify par son webhook (Coolify → resource → *Webhooks*) au lieu du déploiement sur push.

### Mise à jour / opérations courantes

```bash
git push                          # déploie (via Coolify)
# Logs : UI Coolify → service → Logs (ou : docker logs -f <container>)
# Ajouter/corriger une radio : https://admin.piges.vocast.fr (onglet Radios)
# Santé des flux & couverture 24 h : onglet "Santé des flux"
```

### Sans Coolify (docker compose brut)

```bash
git clone https://github.com/Vocast-fr/Vocazap.git && cd Vocazap
cp .env.example .env && nano .env
docker compose up -d --build
```

Puis un reverse proxy (Caddy/Traefik) devant `web` (:3001), `api` (:3000) et `admin` (:3002).

## API principale

| Route | Description |
|---|---|
| `GET /api/radios?category=&q=` | Radios actives (filtre catégorie/recherche) |
| `GET /api/radios/:slug` | Détail d'une radio |
| `GET /api/recordings?radio=&date=&page=` | Piges (jour civil Europe/Paris) |
| `GET /api/recordings/:id/audio` | Audio (Range supporté, `?download` pour attachement) |
| `POST /api/admin/login` | `{password}` → JWT 24 h |
| `GET/POST/PATCH/DELETE /api/admin/radios…` | CRUD radios (Bearer JWT) |
| `POST /api/admin/radios/:id/check` | Test immédiat d'un flux |
| `GET /api/admin/health` | Flux en panne, événements, couverture 24 h |

## Droits d'usage

Pour toute réclamation vis-à-vis d'une des radios enregistrées par ce projet (retrait de données…) : contact@vocast.fr.
