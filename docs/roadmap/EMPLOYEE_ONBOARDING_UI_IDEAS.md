# Employee onboarding — UI ideas backlog

**Status:** Ideas only. No components, effects, or workflow changes below are
approved or implemented.

The VSPH product design system in `DESIGN.md` remains the source of truth.
The current three-step identity → position → review flow is intentionally
compact, and HR/owner permissions remain controlled by the backend.

## Potential enhancements to evaluate later

- **More useful completed state:** a compact sequence showing that the
  employee was created, a private link is ready, and the employee must set
  their password. Avoid implying an email has already been sent.
- **Primary handoff action:** consider one clearly emphasized `Copy link`
  control with precise confirmation and safe fallback for restricted clipboard
  permissions. Keep the one-time token private and never log it.
- **Optional employee summary:** a small review block grouping name/email and
  position details, shown only on the final step if it improves scanning.
  Avoid adding redundant text to the earlier steps.
- **Shorter path to recovery:** on invitation failure, emphasize the existing
  record's account-management link without automatically generating another
  login or duplicating an employee.
- **Subtle motion:** a brief progress-fill transition and clear hover/focus
  feedback are appropriate; any motion must honor reduced-motion preferences.
- **Layout tuning:** compare compact stepper cards with a single-column
  progress rail at intermediate widths, including 200% browser zoom.

## Visual effects — intentionally deferred

A shader, animated gradient, particle field, or 3D background is **not**
recommended for an HR onboarding form. It would add visual noise and extra
rendering cost without helping a user create an employee account.

If design exploration becomes necessary, start with a restrained,
nonanimated VSPH-blue accent confined to the success state or header, with
verified contrast and a plain reduced-motion fallback. Treat this as a new
design proposal, **not** part of the Impeccable `polish` pass.

## Acceptance questions for future proposals

- Does the component reduce clicks, errors, uncertainty, or reading effort?
- Does it retain one obvious primary action and clear permission boundaries?
- Does it work at 390px, tablet and desktop widths, browser zoom, keyboard
  navigation, and with reduced motion?
- Does it preserve the brand palette, Inter typography, and small-footprint
  performance requirements?

Do not ship additional decoration until a concrete user task benefits.
