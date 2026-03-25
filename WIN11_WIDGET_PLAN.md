# Windows 11 PWA Widget Integration

This plan outlines the steps to add a native Windows 11 widget for the Habitikami PWA. This widget will appear in the Windows 11 Widgets Board (accessible via the taskbar or `Win + W`).

## User Review Required

> [!IMPORTANT]
> **Widget Location:** PWA Widgets on Windows 11 appear in the **Widgets Board**, not directly as functional blocks inside the Start Menu (which only supports app icons).
> **Adaptive Cards:** The UI is defined via JSON (Adaptive Cards), not HTML/react. This means the widget UI will be a simplified version of the app.

## Proposed Changes

### PWA Manifest

#### [MODIFY] [manifest.json](file:///c:/DATA/Personal/GitHub/habitikami/habitikami-web/public/manifest.json)
- Add a `widgets` array to define the widget's metadata and template location.

### Widget UI (Adaptive Cards)

#### [NEW] [habit-summary.json](file:///c:/DATA/Personal/GitHub/habitikami/habitikami-web/public/widgets/habit-summary.json) [NEW]
- Define the visual layout of the widget (e.g., today's progress, next habit).

### Service Worker

#### [MODIFY] [sw.js](file:///c:/DATA/Personal/GitHub/habitikami/habitikami-web/public/sw.js)
- Implement `widgetinstall`, `widgetuninstall`, `widgetresume`, and `widgetclick` event listeners.
- Handle data fetching for the widget and updating the Adaptive Card state.

---

## Verification Plan

### Automated Tests
- N/A (Manual OS-level verification required).

### Manual Verification
1.  **Installation:** Install the PWA via Chrome/Edge on Windows 11.
2.  **Widget Board:** Open the Widgets Board (`Win + W`).
3.  **Add Widget:** Click "Add Widgets" (+) and look for "Habitikami".
4.  **Interaction:** Click the widget to ensure it opens the PWA.
5.  **Refresh:** Verify the widget updates periodically (controlled by `update` in manifest).
