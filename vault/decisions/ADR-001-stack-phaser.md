# ADR-001 — Stack web : Phaser 3 + TypeScript + Vite

- **Statut** : accepté (arrêté par Arthur dans le brief)
- **Date** : 2026-06-12

## Contexte

Reconstruire en jeu web le prototype Unity 2D top-down Codyssey. Besoin : tilemaps, sprites/anim, scènes, build statique servi par nginx, sans backend.

## Décision

**Phaser 3 + TypeScript + Vite.**

## Justification

- Maturité 2D top-down, tilemaps, sprite atlas/anim, système de scènes proche de la logique Unity (scènes, GameObjects → entités).
- Build statique trivial (`vite build` → `dist/`).
- Excellente DX (HMR, TS).

## Conséquences

- Pas de moteur lourd côté navigateur ; bundle maîtrisable.
- Mapping conceptuel Unity→Phaser : Scene→Scene, MonoBehaviour→classe système/entité, ScriptableObject→JSON `/content`, SpriteRenderer+anim→spritesheet/atlas Phaser, Rigidbody2D→Arcade Physics, singletons UI→UIScene Phaser superposée.
- Objection éventuelle à soumettre à Arthur avant tout écart.
