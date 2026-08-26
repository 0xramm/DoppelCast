// Combo strings look like "Ctrl+Alt+KeyR": modifiers (in this fixed order)
// plus a raw KeyboardEvent.code, which conveniently already matches Rust's
// Code::from_str variant names 1:1 (both follow the same UI Events Code
// spec) -- so the string built here can go straight to the set_hotkey
// command with no translation.

const MODIFIER_CODES = new Set([
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "ShiftLeft",
  "ShiftRight",
  "MetaLeft",
  "MetaRight",
]);

// Returns null while the user is still just holding modifiers -- a combo
// only counts once they press a non-modifier key alongside at least one.
export function captureCombo(e: KeyboardEvent): string | null {
  if (MODIFIER_CODES.has(e.code)) return null;

  const mods: string[] = [];
  if (e.ctrlKey) mods.push("Ctrl");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  if (e.metaKey) mods.push("Win");
  if (mods.length === 0) return null;

  return [...mods, e.code].join("+");
}

// "Ctrl+Alt+KeyR" -> "Ctrl+Alt+R", "Ctrl+Digit5" -> "Ctrl+5", "Ctrl+F5" stays.
export function formatHotkey(combo: string): string {
  return combo
    .split("+")
    .map((part) => part.replace(/^Key/, "").replace(/^Digit/, ""))
    .join("+");
}
