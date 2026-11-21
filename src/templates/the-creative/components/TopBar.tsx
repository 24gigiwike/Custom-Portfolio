import { creativeHomePath, creativeNavigate } from "../template/creativePaths.ts";

export function TopBar({
  name,
  menuOpen,
  onMenu,
}: {
  name: string;
  menuOpen: boolean;
  onMenu: () => void;
}) {
  const home = creativeHomePath();
  return (
    <header className="creative-top">
      {name ? (
        <a
          href={home}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
            event.preventDefault();
            creativeNavigate(home);
          }}
        >
          © {name}
        </a>
      ) : <span />}
      <button type="button" aria-expanded={menuOpen} onClick={onMenu}>
        {menuOpen ? "Close" : "Menu"}
      </button>
    </header>
  );
}
