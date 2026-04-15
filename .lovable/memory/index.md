# Project Memory

## Core
Lovable Cloud + Supabase backend. Transitioning to native iOS via Capacitor.
Store dates as local 'YYYY-MM-DD', never ISO, to prevent timezone bugs.
Identity via name selection (localStorage). Edit/delete restricted to author.
Mobile UI: vertical inputs for dates/times; delete/action buttons always visible (no hover-only).
Design: Inter font (never Nunito), cool blue/gray, glassmorphism. Use shimmer skeletons, not spinners.

## Memories
- [Visual Aesthetic](mem://style/aesthetic) — Colors, Inter font, glassmorphism, and skeleton loaders
- [Database Triggers](mem://tech/database) — Activity log triggers and omitted FK constraints for history preservation
- [Activity Feed](mem://features/activity-tracking) — Feed specs, photo attachments, timestamps, edit markers
- [Family Profiles](mem://features/family-members) — Predefined list, avatar hierarchy, and online status indicators
- [Calendar View](mem://features/calendar-view) — Monthly grid with activity frequency dots and day filtering
- [PWA Integration](mem://tech/pwa-integration) — SW, injectManifest, iOS constraints, and periodic sync
- [Activity Categories](mem://features/activity-categories) — Predefined types, emojis, colors, and DB check constraint
- [In-App Notifications](mem://features/in-app-notifications) — Unread badges, dropdown feed, and fan-out logic
- [Push Notifications](mem://features/push-notifications) — Web Push via Supabase Edge Functions, iOS badge sync
- [Push Tech Specs](mem://tech/push-implementation) — AES-128-GCM, VAPID JWT, pg_net triggers, and iOS key normalization
- [Diagnostics](mem://features/diagnostics-tool) — `/debug` route for PWA and push troubleshooting
- [Native iOS Strategy](mem://tech/native-ios-strategy) — Capacitor, GitHub Actions builds, Lovable preview URL syncing
- [Animations](mem://style/animations) — framer-motion, AnimatePresence, staggered lists, spring forms
- [Activity Reactions](mem://features/activity-reactions) — Emoji reactions, activity_reactions table, toggle logic
- [Pull to Refresh](mem://features/pull-to-refresh) — Mobile pull-to-refresh via framer-motion for feed sync
- [Member Filter Chips](mem://features/member-filter-chips) — Tappable avatar chips to filter feed by member, with haptic feedback
