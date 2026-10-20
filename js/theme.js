const themeBtn = document.getElementById("theme");
const themeIcon = document.getElementById("themeIcon");

function updateThemeIcon() {
  if (!themeIcon) return;
  const dark = document.body.classList.contains("dark");
  themeIcon.textContent = dark ? "light_mode" : "dark_mode";
  if (themeBtn) {
    themeBtn.title = dark ? "Switch to light mode" : "Switch to dark mode";
  }
}

function getThemeMode() {
  if (window.DriveSettings && window.DriveSettings.get) {
    const s = window.DriveSettings.get();
    if (s && s.appearance) return s.appearance;
  }
  return localStorage.getItem("themeMode") || localStorage.getItem("theme") || "system";
}

function applyThemeFromSettings() {
  const mode = getThemeMode();
  const preferDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  let dark = false;
  if (mode === "dark") dark = true;
  else if (mode === "light") dark = false;
  else dark = !!preferDark;

  document.body.classList.toggle("dark", dark);
  localStorage.setItem("theme", dark ? "dark" : "light");
  if (!localStorage.getItem("themeMode")) {
    localStorage.setItem("themeMode", mode === "system" ? "system" : mode);
  }
  updateThemeIcon();
}

function setThemeMode(mode) {
  // mode: light | dark | system
  localStorage.setItem("themeMode", mode);
  if (mode === "light" || mode === "dark") {
    localStorage.setItem("theme", mode);
  }
  if (window.DriveSettings && window.DriveSettings.save) {
    window.DriveSettings.save({ appearance: mode });
  } else {
    // still apply without settings module
    const preferDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    let dark = mode === "dark" || (mode === "system" && preferDark);
    if (mode === "light") dark = false;
    document.body.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }
  applyThemeFromSettings();
  // refresh settings panel if open
  if (window.DriveApp && window.DriveApp.render) {
    try {
      window.DriveApp.render();
    } catch (e) {}
  }
}

if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const goingDark = !document.body.classList.contains("dark");
    setThemeMode(goingDark ? "dark" : "light");
  });
}

applyThemeFromSettings();

if (window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getThemeMode() === "system") applyThemeFromSettings();
  });
}

window.MiniDriveTheme = {
  apply: applyThemeFromSettings,
  setMode: setThemeMode,
  getMode: getThemeMode,
};
