#!/bin/bash

# 1. Initialisation de Git LFS sur la machine
echo "🚀 Initialisation de Git LFS..."
git lfs install

# 2. Liste des extensions courantes en Game Dev / Unity
# On suit les modèles 3D, les textures, l'audio et les vidéos
echo "📦 Configuration du suivi des fichiers volumineux (LFS)..."

# Modèles 3D et Animation
git lfs track "*.fbx"
git lfs track "*.obj"
git lfs track "*.max"
git lfs track "*.blend"
git lfs track "*.dae"

# Textures et Images lourdes
git lfs track "*.psd"
git lfs track "*.tga"
git lfs track "*.png"
git lfs track "*.jpg"
git lfs track "*.jpeg"
git lfs track "*.exr"
git lfs track "*.hdr"

# Audio
git lfs track "*.wav"
git lfs track "*.mp3"
git lfs track "*.ogg"
git lfs track "*.aif"

# Vidéo
git lfs track "*.mp4"
git lfs track "*.mov"

# Binaires Unity et autres
git lfs track "*.pdf"
git lfs track "*.zip"
git lfs track "*.7z"
git lfs track "*.dll"
git lfs track "*.so"
git lfs track "*.dylib"

# 3. Ajout du fichier de configuration à Git
echo "📝 Ajout du fichier .gitattributes..."
git add .gitattributes

echo "✅ Terminé ! N'oublie pas de faire un commit : git commit -m 'Config LFS initialisée'"
