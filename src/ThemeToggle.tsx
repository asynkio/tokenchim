import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme);
  useEffect(() => {
    const sync = () => setTheme(document.documentElement.dataset.theme);
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  const label = theme === "light" ? "切换到深色模式" : "切换到浅色模式";
  return (
    <button
      className="theme-toggle"
      aria-label={label}
      title={label}
      onClick={() => {
        const next = theme === "light" ? "dark" : "light";
        document.documentElement.dataset.theme = next;
        document
          .querySelector('meta[name="theme-color"]')
          ?.setAttribute("content", next === "light" ? "#f6f4fb" : "#090b14");
        try {
          localStorage.setItem("tokenchim-theme", next);
        } catch {}
        dispatchEvent(new Event("tokenchim-theme"));
        setTheme(next);
      }}
    >
      {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
