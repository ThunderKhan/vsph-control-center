# Workspace sidebar — compact desktop mode

## Design decision

The main shell is an ordinary CSS Grid with two columns, `256px minmax(0,1fr)` when expanded. For desktop widths above 950px, setting `data-sidebar-state="collapsed"` on `<html>` changes the first grid track to **72px**. CSS interpolates the **grid-template-columns** track size over 260ms, and the `minmax(0,1fr)` content area naturally occupies the newly available space. No absolute-position trick, content translation, or hand-computed left margin is used.

This follows [MDN's grid track sizing and animation reference](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/grid-template-columns). The button follows the [WAI-ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/): it is a native button with `aria-controls`, a current `aria-expanded` state, and a changing accessible label. It works with Tab and native Enter/Space keyboard activation. No incorrect application `role="menu"` is used.

## States

- **Expanded (desktop):** the existing 256px left navigation with labels, account details, and collapse toggle.
- **Collapsed (desktop):** 72px icon rail with a compact VSPH logo, centered icons, native `title` tooltips, and complete `aria-label` names. The expand toggle remains visible. The authenticated platform-admin links retain their backend/UI permissions.
- **Mobile/tablet (950px or narrower):** the existing full-label off-canvas drawer with backdrop, focus handling, and Escape behavior. The desktop toggle is hidden, and the stored desktop preference does not force an icon rail.
- **Preference:** clicking the desktop toggle stores `vsph.sidebar.collapsed` in `localStorage`, guarded against private mode/blocked storage. The early head script restores it **before paint** on both `/dashboard` and `/applications` to avoid a sidebar-width flash. Missing/invalid storage falls back to expanded.
- **Reduced motion:** `prefers-reduced-motion:reduce` disables the shell width transition and sidebar toggle transition.

## Manual QA

1. Sign in as an ordinary account, open Overview, collapse, expand. Confirm the main grid and cards fluidly reflow, retain keyboard navigation, and no horizontal page scrollbar appears.
2. Collapse and visit Applications. Confirm icon rail stays collapsed, app search works, and the links remain accessible with mouse/keyboard and native title tooltip.
3. Sign in as a platform super admin and repeat. Ensure Platform administration and New customer appear in the rail; ordinary users never see them.
4. Resize across 1150px and 950px. At <=950px the full mobile drawer, backdrop, close button and Escape/focus behavior must work. Returning to desktop restores the chosen rail state.
5. In private browsing, or with storage blocked, toggle should still work for the current page. Refresh defaults to expanded if storing is unavailable.
6. Activate Windows reduced motion and check for no width animation.
7. Browser zoom at 200% / 400% to verify controls remain reachable.

Automated checks in `tests/sidebar-layout.test.js` and `tests/dashboard.test.js` cover the desktop layout contract, state changes, accessibility labels, storage failures, and view/role invariants. Visual viewport QA is still recommended before merging.
