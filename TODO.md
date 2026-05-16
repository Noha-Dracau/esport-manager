# TODO — E-Sport Tournament Manager

Tâches à traiter par lots pour limiter les régressions. Faire un commit après chaque tâche, tester avant de passer à la suivante.

## Lot 1 — Sécurité & validations

Petites tâches isolées, faible risque, gros bénéfice. Commencer par là.

### 1.1 — Limites de longueur sur les champs texte

Ajouter une validation côté backend qui rejette les entrées trop longues, et appliquer les mêmes limites côté frontend via `maxLength` sur les inputs.

Limites suggérées :
- Nom de tournoi : 100 caractères
- Description de tournoi : 500 caractères
- Pseudo utilisateur : 30 caractères
- Email : 100 caractères
- Nom d'équipe : 50 caractères
- Nom de jeu (champ libre "Autre") : 50 caractères

Renvoyer un 400 avec un message d'erreur clair côté backend. Routes concernées : `POST /auth/register`, `PATCH /users/:id`, `POST /tournaments`, `PATCH /tournaments/:id`, `POST /teams`, `PATCH /teams/:id`.

### 1.2 — Validation des fichiers uploadés (logos / avatars)

Actuellement multer accepte n'importe quel type et taille. Failles : un PDF de 500 Mo peut être uploadé, voire un exécutable.

À faire :
- Restreindre via `fileFilter` aux types `image/jpeg`, `image/png`, `image/webp`
- Limiter la taille à 2 Mo via `limits: { fileSize: 2 * 1024 * 1024 }`
- Renvoyer une erreur claire si rejeté
- Installer `sharp` et compresser/redimensionner les images à l'upload (max 800×800, qualité 85)

Routes concernées : `POST /tournaments`, `PATCH /tournaments/:id`, `POST /teams`, `PATCH /teams/:id`, `PATCH /users/:id` (avatar).

### 1.3 — Date de tournoi : pas dans le passé

Refuser côté backend toute création ou modification de tournoi avec une `date` antérieure à aujourd'hui. Renvoyer un 400.

Côté frontend, ajouter `min={today}` sur les inputs `type="date"` dans `CreateTournamentPage` et `TournamentDetailPage`.

### 1.4 — Garde-fous de statut sur les routes manager

Les routes ci-dessous ne vérifient pas le statut du tournoi et permettent à un manager (via appel API direct) de casser un tournoi en cours :

- `DELETE /:id/participants/:participantId` : autoriser uniquement si `status === 'open'`
- Vérifier les autres routes manager (`PATCH`, `DELETE`, swap, generate) pour cohérence

### 1.5 — Limite de participants pour le Round Robin

Le RR génère N*(N-1)/2 matchs. À 16 joueurs c'est 120 matchs, c'est ingérable.

À faire : côté backend dans `POST /tournaments` et `PATCH /tournaments/:id`, refuser un tournoi `round_robin` avec `max_participants > 8` (ou choisir une autre limite raisonnable). Côté frontend, désactiver les valeurs au-delà de cette limite dans le slider quand `format === 'round_robin'`.

---

## Lot 2 — UX immédiate

### 2.1 — Sidebar fixe

La sidebar et notamment les boutons profil / login-logout doivent rester visibles quand on scrolle. Utiliser `position: sticky` + `top: 0` + `height: 100vh` sur le composant Sidebar.

### 2.2 — Cleanup des boutons en mode édition de tournoi

Quand `editing === true` dans `TournamentDetailPage`, masquer les éléments superflus :
- Bouton "Manage tournament"
- Bouton "Register" / "Unregister"
- Liste des participants
- Bracket

Garder uniquement le formulaire d'édition, les boutons Save / Cancel, et le badge de statut.

### 2.3 — Affichage des avatars et logos dans le bracket

Actuellement le bracket affiche la première lettre du pseudo / nom d'équipe au lieu de l'image de profil ou du logo.

À faire :
- Étendre `fetchNames` dans `TournamentBracket.jsx` pour récupérer aussi `avatar_url` (pour les users) ou `logo_url` (pour les teams)
- Stocker dans un map `images[id]`
- Dans `MatchCard`, afficher l'image si présente, fallback sur la première lettre

Idem dans `RoundRobinView.jsx` et dans la liste des participants de `TournamentDetailPage.jsx`.

### 2.4 — Liste de jeux étoffée + option "Autre"

Refactoriser la liste hardcodée actuelle :
['League of Legends','Valorant','CS2','Fortnite','Rocket League','Overwatch 2','FIFA','Street Fighter 6']
À faire :
- Élargir la liste (Apex Legends, Dota 2, Hearthstone, Rainbow Six Siege, Smash Bros, Tekken 8, Mortal Kombat 1, etc.)
- Trier par ordre alphabétique
- Ajouter une option "Autre" en fin de liste qui affiche un champ texte libre (max 50 caractères, validation Lot 1.1)
- Centraliser la liste dans un fichier `client/src/constants/games.js` pour réutilisation

### 2.5 — Warning si démarrage du tournoi avant la date prévue

Dans `ManageTournamentPage`, dans `handleStart`, si `tournament.date > today`, ajouter au texte de confirmation un avertissement : "La date prévue du tournoi est le X. Démarrer quand même ?"

Soft warning UX, pas un blocage.

---

## Lot 3 — Liste des tournois

### 3.1 — Tournois terminés grisés et en fin de liste

Sur `TournamentsPage`, modifier le tri pour que les tournois `finished` apparaissent toujours en bas, peu importe leur date. Les afficher en plus grisé (opacity 0.6).

À faire backend : modifier le `ORDER BY` dans `GET /tournaments` pour trier par `CASE WHEN status = 'finished' THEN 1 ELSE 0 END, created_at DESC`.

### 3.2 — Filtre par statut

Ajouter un filtre dropdown "Statut" à côté des filtres jeu et mode existants : Tous / Ouverts / En cours / Terminés.

Backend : étendre `GET /tournaments` pour accepter `?status=open|ongoing|finished`.
Frontend : ajouter le select dans `TournamentsPage` et passer le param.

---

## Lot 4 — Backend (cleanup)

### 4.1 — Suppression des uploads orphelins

Actuellement les fichiers uploadés dans `server/uploads/` restent sur disque même quand l'entité référente est supprimée ou que l'image est remplacée.

À faire :
- Au `DELETE /tournaments/:id` : supprimer le fichier `logo_url` du tournoi s'il existe
- Au `DELETE /teams/:id` : supprimer le `logo_url` de l'équipe
- Au `PATCH /tournaments/:id` avec nouveau logo : supprimer l'ancien fichier
- Idem pour `PATCH /teams/:id` et `PATCH /users/:id` (avatar)

Utiliser `fs.unlinkSync` avec try/catch pour ne pas faire planter la route si le fichier n'existe plus.

### 4.2 — Vérifier l'implémentation du kick depuis la liste des participants

Code fourni précédemment dans `TournamentDetailPage.jsx` (bouton ✕ à côté de chaque participant en statut `open`). À vérifier que c'est bien intégré et fonctionnel pour les deux modes (`players` et `teams`).

Ce kick depuis la liste remplace fonctionnellement celui du bracket. Le kick du bracket peut être conservé (cohérence visuelle) ou supprimé. Décision à prendre.

---

## Lot 5 — Final

### 5.1 — Uniformisation en anglais

Passe globale sur tous les messages d'erreur backend, les labels UI, les confirmations, les placeholders. Actuellement mélange français/anglais.

À faire en dernier pour ne pas se mélanger pendant le développement des autres lots.

Fichiers concernés (non exhaustif) :
- `server/src/routes/*.js` (messages d'erreur)
- `server/src/middleware/auth.js`
- Toutes les pages dans `client/src/pages/`
- Tous les composants dans `client/src/components/`

---

## Améliorations potentielles (hors scope immédiat)

À considérer après les 5 lots ci-dessus, à discuter si on veut les attaquer :

- **Page "Résultats finaux" / podium** pour les tournois `finished`, affichant 1er/2ème/3ème en grand au lieu du bracket figé
- **Modification du gagnant en double élim** (actuellement bloquée — refactor possible : nettoyer en cascade tous les matchs aval dans WB + LB)
- **Pagination** sur la liste des tournois si la base grandit
- **Hydratation participants côté backend** : ajouter une route `GET /tournaments/:id/participants` qui renvoie déjà les noms et avatars pour éviter N requêtes côté frontend
- **Rate limiting** sur `/auth/login` et `/auth/register`
- **Refresh automatique** du bracket (polling ou WebSocket) pour que les spectateurs voient les mises à jour sans F5
- **Indicateur visuel des matchs "prêts à jouer"** (les deux participants présents + status pending) vs "en attente d'un participant" dans le bracket
- **Affichage propre des BYEs** ("Qualifié sans match" au lieu de scores `null - null`)
- **Tests unitaires** sur les générateurs (bracketGenerator, roundRobinGenerator) et `propagateByesDouble`
- **Découpage de `routes/tournaments.js`** (~900 lignes) en sous-fichiers : tournois, brackets, matchs
- **Déplacement des helpers d'avancement** (single elim, double elim, propagation BYE) de `routes/` vers `utils/`
