# Quest Log — synchronisation Google Drive

La synchro est optionnelle : sans connexion, tout reste sauvegardé dans le navigateur (LocalStorage).

## 1. Créer l'ID client Google (une seule fois, gratuit)
1. Va sur https://console.cloud.google.com et crée un projet.
2. **API et services > Bibliothèque** : active **Google Drive API**.
3. **Écran de consentement OAuth** (Google Auth Platform) : type *Externe*, renseigne le nom de l'app et ton e-mail.
   Tant que l'app est en mode « Test », ajoute ton adresse Gmail (et celles des testeurs) dans **Utilisateurs de test**.
4. **Identifiants > Créer des identifiants > ID client OAuth** : type **Application Web**.
   - **Origines JavaScript autorisées** : `http://localhost:8000` (+ l'adresse de ton site si tu l'héberges).
   - Aucun URI de redirection n'est nécessaire.
5. Copie l'ID client (`xxxx.apps.googleusercontent.com`) dans `js/drive.js`, constante `GOOGLE_CLIENT_ID`.

Les noms de menus de la console Google évoluent parfois : les étapes restent les mêmes.

## 2. Lancer l'application (obligatoire : pas en double-cliquant sur index.html)
Google refuse les pages ouvertes en `file://`. Dans le dossier du projet :

    python3 -m http.server 8000

puis ouvre http://localhost:8000

## 3. Ce qui est stocké
- Fichier **QuestLog-sauvegarde.json**, visible dans « Mon Drive ».
- Droit demandé : `drive.file` (accès uniquement au fichier créé par l'app, jamais au reste du Drive).
- Plusieurs appareils : les quêtes sont fusionnées, la version la plus récente de chaque quête l'emporte.
