---
name: Member filter chips
description: Tappable avatar chips to filter feed by family member, with haptic feedback
type: feature
---
- `MemberFilterChips` component renders horizontally scrollable avatar buttons for each family member
- Tapping a chip filters the activity feed to that member; tapping again clears the filter
- Works alongside the existing date filter (both filters combine)
- Haptic feedback (`src/lib/haptics.ts`) triggers on filter taps, reactions, and pull-to-refresh
