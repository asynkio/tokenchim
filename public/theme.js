(() => {
  const media = matchMedia("(prefers-color-scheme: light)");
  let preference;
  try {
    preference = localStorage.getItem("tokenchim-theme");
  } catch {}
  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "light" ? "#f6f4fb" : "#090b14");
  }
  apply(
    preference === "light" || preference === "dark"
      ? preference
      : media.matches
        ? "light"
        : "dark",
  );
  media.addEventListener("change", () => {
    if (preference !== "light" && preference !== "dark")
      apply(media.matches ? "light" : "dark");
  });
  addEventListener("tokenchim-theme", () => {
    preference = document.documentElement.dataset.theme;
  });
  addEventListener("storage", (event) => {
    if (event.key !== "tokenchim-theme" && event.key !== null) return;
    preference = event.newValue;
    apply(
      preference === "light" || preference === "dark"
        ? preference
        : media.matches
          ? "light"
          : "dark",
    );
  });
})();
