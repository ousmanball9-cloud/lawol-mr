# LAWOL.mr — Ton stage, sans le stress
Plateforme de matching offres stages/emplois pour étudiants mauritaniens. Notification WhatsApp automatisée, matching par profil, sources officielles.

## 🚀 Démarrage (Codespaces)
```bash
pnpm install
cp .env.example .env
# Édite .env avec tes clés Supabase
pnpm dev
```
→ Web: http://localhost:3000

## ☁️ Déploiement gratuit
| Service | Rôle | Free tier |
|---------|------|-----------|
| Supabase | DB + Auth | 500 Mo |
| Vercel | Next.js Web | 100 Go bandwidth |
| GitHub | CI/CD + Codespaces | 2000 min/mois |

## 📱 Prochaines étapes
- [x] Sprint 0 : Landing + Supabase schema ← **ICI**
- [ ] Sprint 1 : API FastAPI + Scraper + Matching
- [ ] Sprint 2 : WhatsApp Bot + Test 10 étudiants
- [ ] Sprint 3 : Dashboard Admin + Onboarding WebView