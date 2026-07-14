# Naked Development — Motion Design System (POC)
# The Hooked Framework Applied to UI Animation
# Version 2.0 — Zero new packages. Works with what is already installed.

---

## PHILOSOPHY

Animation is not decoration. Animation is communication.

Every animated moment must earn its place by doing one of three jobs:
1. **Close a feedback loop** — confirm an action worked
2. **Guide attention** — show the user where to look next
3. **Deliver a reward** — make the user feel something good happened

If an animation does none of these three jobs, it does not ship.

---

## ETHICAL GUARDRAIL

This is a persuasive design system. Never apply variable reward or investment animations to:
- Destructive or irreversible actions (delete, purchase, trade confirmations)
- Repeat spending triggers in financially sensitive contexts
- Any moment where the user should pause and think, not feel rewarded

---

## THE HOOKED FRAMEWORK

**Trigger → Action → Variable Reward → Investment**

- **Action** — the tap. Animation here is micro and instant.
- **Variable Reward** — the reward must feel good and feel variable. Same animation every time trains the brain to ignore it.
- **Investment** — accumulation of value over time. Streaks, progress, collections growing.

---

## WHAT IS ALREADY INSTALLED — USE ONLY THESE

### Mobile (React Native / Expo)
- **React Native `Animated` API** — built in, no install needed
- **`react-native-reanimated`** — if already in package.json, use it. If not, use core Animated.
- **`expo-haptics`** — if already installed, use it. If not, skip haptics and note in MOTION LOG.

### Web (React / Vite)
- **CSS transitions** — always available, no install needed
- **`framer-motion`** — if already in package.json, use it. If not, use CSS transitions.

### Rule
Check `package.json` before writing any animation code. Use only what is there. Never install new packages. If a package you want is missing, note it in the MOTION LOG as "package needed" and implement the moment without it using the fallback approach.

---

## THE 12 HOOKED MOMENTS

### 1. COMPLETION
User finished something — task, form, workout, payment.
**Mobile:** Scale the element to 1.05 then back to 1.0 using Animated.spring. If expo-haptics installed: `Haptics.notificationAsync(NotificationFeedbackType.Success)`
**Web:** CSS transform scale with ease-out transition.
**Never:** No animation at all. Silent state change.

### 2. LOADING / PROCESSING
App is working on something.
**Mobile:** Animated.loop with opacity pulse (1.0 → 0.4 → 1.0).
**Web:** CSS keyframe opacity pulse.
**Never:** Frozen screen. Generic spinner with no character.

### 3. EMPTY STATE
No content yet.
**Mobile:** Animated.timing fade in on mount.
**Web:** CSS opacity transition on mount.
**Never:** Content that just appears instantly with no acknowledgment.

### 4. ERROR
Something went wrong.
**Mobile:** Animated.sequence — translate X left 6, right 10, left 10, right 6, back to 0 (shake). If expo-haptics: `Haptics.notificationAsync(NotificationFeedbackType.Error)`
**Web:** CSS keyframe shake on the element.
**Never:** Silent red border with no motion.

### 5. ONBOARDING / FIRST USE
User sees something for the first time.
**Mobile:** Staggered Animated.timing fade-ins — elements arrive 80ms apart.
**Web:** Staggered CSS transitions with delay increments.
**Never:** Everything appearing at once.

### 6. SCREEN TRANSITION
User navigated somewhere.
**Mobile:** React Navigation handles this — configure slide or fade in navigator config only.
**Web:** CSS opacity/transform on route change.
**Never:** Hard cuts between screens.

### 7. MICRO-INTERACTIONS
Button tap, toggle, selection.
**Mobile:** Animated.spring scale to 0.97 on press, 1.0 on release.
**Web:** CSS transform scale on :active state.
**If expo-haptics installed:** `Haptics.impactAsync(ImpactFeedbackStyle.Light)` on tap.
**Never:** Button that looks identical before and after tap.

### 8. DATA ARRIVAL
Content loaded and appeared.
**Mobile:** Staggered Animated.timing fade + translate Y from +8 to 0 for list items.
**Web:** Staggered CSS transitions.
**Never:** Content popping in all at once.

### 9. PULL-TO-REFRESH
User pulled down on a list.
**Mobile:** Use the platform's built-in RefreshControl — no custom animation needed.
**Web:** CSS transform on the pull indicator.
**Never:** No feedback at the pull threshold.

### 10. SWIPE-TO-DISMISS / DELETE
User swiped an item.
**Mobile:** Animated.event tied to PanResponder or Gesture Handler if already installed.
**Web:** CSS transform tied to pointer events.
**If expo-haptics installed:** `Haptics.impactAsync(ImpactFeedbackStyle.Heavy)` on delete confirm.
**Never:** Instant disappearance with no motion.

### 11. DRAG-TO-REORDER
User is reorganizing items.
**Mobile:** Use Gesture Handler if already installed. Scale to 1.03 on lift.
**Web:** CSS transform on drag.
**Never:** Items teleporting to new positions.

### 12. INVESTMENT / PROGRESS
Streak growing, progress bar filling, stats updating.
**Mobile:** Animated.timing number count-up. Animated.spring bar fill.
**Web:** CSS width transition for bars. JS counter for numbers.
**If expo-haptics installed:** `Haptics.impactAsync(ImpactFeedbackStyle.Medium)` on milestone.
**Never:** Numbers that just instantly update.

---

## DURATION SCALE

All durations come from this scale. No arbitrary values.

| Name | Duration | Use |
|------|----------|-----|
| Instant | 100ms | Button press, micro tap response |
| Fast | 200ms | Toggle, selection, small state change |
| Standard | 300ms | Most transitions, fade, card animation |
| Expressive | 500ms | Screen transitions, hero moments |
| Slow | 800ms | Onboarding sequences, investment animations |

---

## SPRING CONFIG

```javascript
// Standard — most use cases
{ damping: 15, stiffness: 150, mass: 1 }

// Gentle — cards, lists
{ damping: 20, stiffness: 120, mass: 1 }

// Snappy — button press, toggle
{ damping: 10, stiffness: 200, mass: 0.8 }
```

---

## VARIABLE REWARD PATTERN

Do not use the same animation for every completion. Vary it:

```javascript
// Simple pool rotation — no extra packages needed
const completionScales = [1.05, 1.08, 1.04, 1.06];
const getCompletionScale = (count) => completionScales[count % completionScales.length];

// Streak escalation
const getCompletionDuration = (streakCount) => {
  if (streakCount >= 30) return 600; // bigger, slower celebration
  if (streakCount >= 7) return 450;
  return 300; // standard
};
```

---

## REDUCED MOTION

Always detect and respect reduced motion preference.

**Mobile:**
```javascript
import { AccessibilityInfo } from 'react-native';
const [reducedMotion, setReducedMotion] = useState(false);
useEffect(() => {
  AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
}, []);
```

**Web:**
```javascript
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```

**Fallback rule:** When reduced motion is on — skip all scale and translate animations. Keep opacity fades at 200ms max. Keep haptics (they are not motion).

---

## PERFORMANCE RULES

- Mobile: always `useNativeDriver: true` for Animated. Use Reanimated worklets if available.
- Animate only `transform` and `opacity` — never `width`, `height`, or `margin`
- 60fps is the hard floor — if an animation drops frames on mid-range Android, remove it
- Never run more than 2 simultaneous animations on the same screen

---

## WHAT NEVER GETS ANIMATED

- Background color changes on idle screens
- Text that is already readable
- Anything that plays on every render without user action
- Continuous idle animations on buttons (implies "tap me" — creates anxiety)
- Any animation while the user is typing
- Destructive action confirmations — these must feel deliberate, not rewarding

---

## MOTION DESIGNER DECISION CHECKLIST

Before adding any animation:

1. Which of the 12 Hooked moments is this? If none — no animation.
2. Which Hooked stage? Variable Reward or Investment?
3. Is this a variable reward moment? Vary the duration or scale — don't use identical animation every time.
4. What is the user feeling? Match energy to emotional context.
5. What is already installed? Use only those packages.
6. If expo-haptics is installed — which haptic pairs with this?
7. What duration from the scale?
8. Does it loop?
9. What is the reduced motion fallback?
10. Will this hit 60fps on mid-range Android?
11. Does removing this hurt the experience? If no — remove it.

---

## MOTION LOG FORMAT

After every run write to BUILD_LOG.md:

```
MOTION LOG — {task title} — {date}
Packages available: [list from package.json check]
Packages missing (noted for future): [list]

Decisions:
  Screen: {name}
  Moment: {which of the 12}
  Implementation: {what was coded}
  Haptic: {which / none}
  Duration: {from scale}
  Reduced motion fallback: {what happens}
```

---

## READING THIS FILE

The Motion Designer role reads this entire file before touching any screen. Every decision is justified against this document. If it cannot be justified — it does not ship. Never install packages. Use only what is already in the project.
