# LAWOL.mr — Lean Canvas

> **"Ton stage, sans le stress"**
> Plateforme qui envoie aux étudiants mauritaniens uniquement les offres de stage/PFE/emploi junior correspondant à leur profil, via WhatsApp.

---

| | |
|---|---|
| **PROBLÈME** | 1. Étudiants mauritaniens : offres de stage PFE invisibles, dispersées (WhatsApp, Facebook, bouche à oreille), aucune centralisation<br>2. Pas de matching profil ↔ offre : les étudiants postulent à côté<br>3. Entreprises : difficile de toucher les bons profils (pas de canal ciblé) |
| **SOLUTION** | Bot WhatsApp + API : l'étudiant inscrit son profil → reçoit uniquement les offres matchées. Les entreprises envoient leurs offres au bot. |
| **SEGMENTS** | 🎯 **Priorité (Pareto)** : Stagiaires PFE (cycle court, offres abondantes, métriques rapides)<br>Phase 2 : emploi junior, alternance |
| **SOURCES D'OFFRES** | beta.mr (portail scrapable), WhatsApp (entreprises → bot), Facebook (plus tard) |
| **MÉTRIQUES** | ⭐ North Star : **matches envoyés / semaine**<br>Secondaires : étudiants inscrits, offres collectées, taux de réponse |
| **AVANTAGES** | WhatsApp = canal quotidien en Mauritanie (pas d'app à installer) · matching automatique · 100% gratuit · local |
| **CONTRAINTES** | Budget 0 € (Supabase Free, Vercel Free, Railway Free, Meta WhatsApp 1000 conv/mois) · sécurité (RLS, validation, anti-XSS) |
| **ÉTAT** | S0 landing ✅ · S1 API+matching+scraper ✅ · S2 WhatsApp bot ⏳ · S3 dashboard ⏳ |
