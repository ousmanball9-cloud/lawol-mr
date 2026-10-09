# Brief — Vue détail d'une offre / bourse

## Objectif
Quand l'étudiant clique sur une carte offre, il voit une **vue détaillée** lui
donnant tout ce qu'il faut pour postuler, puis il peut marquer « J'ai postulé ».

## Interaction
- Clic sur la carte (ou son titre) → **modal/panneau** (recommandé : dialog Tailwind
  léger, sans dépendance) OU page `/offre/[id]`. Choix : modal = moins de navigation.
- Fermeture : bouton ✕ + clic hors cadre + Échap.

## Contenu à afficher (ordre)
1. **Badge type** (couleur par type) + **titre**
2. **Entreprise** + **ville** + **source** (source_name)
3. **Date limite en clair** : « Avant le 31 déc. 2026 » + **compte à rebours J-12**
   (calcul client, date_limite - today) ; si dépassé : « Clôturée » en rouge.
4. **Description** complète (scroll si longue) — le texte tronqué `line-clamp-2`
   sur la carte reste, la modale montre tout.
5. **Filières cibles** (badges) si présentes.
6. **Section « Comment postuler »** (le cœur de la demande), dans cet ordre et
   UNIQUEMENT si le champ existe :
   - `contact_email` → bouton « Postuler par e-mail » (mailto:)
   - `contact_whatsapp` → bouton « Écrire sur WhatsApp » (wa.me/<numéro nettoyé>)
   - `source_url` → bouton « Voir l'offre originale » (target=_blank, rel=noopener)
   - si aucun des trois → message « Aucun canal de candidature indiqué —
     cherche l'entreprise sur Google/LinkedIn ».
7. **Bouton primaire** « J'ai postulé » (POST matches/{id}/postule, état Postulé ✅).

## Champs backend déjà exposés (ne rien demander de plus)
GET /api/v1/matches → offre : id, titre, entreprise, ville, type_offre, description,
date_limite, contact_email, contact_whatsapp, source_url, source_name, filieres_cibles
+ match : id, score, postule.

## Fichiers
- `apps/web/app/profil/[telephone]/page.tsx` : ouvrir la modale au clic sur la carte,
  état `offreOuverte`, garder filtres/boutons existants intacts.

## Critères
- lint + build 0 erreur ; apostrophes échappées ; aucune logique existante cassée ;
  mobile : modale scrollable, hauteur max ~85vh.

## Limite
- Pas de nouvelle dépendance, pas de backend, pas de redesign (l'agent design passe
  avant/après — s'aligner sur le style des cartes livré).
