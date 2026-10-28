type OpenMenu = () => void;

let openMenu: OpenMenu | null = null;

export function registerAppMenu(open: OpenMenu) {
  openMenu = open;
  return () => {
    if (openMenu === open) openMenu = null;
  };
}

export function openAppMenu() {
  openMenu?.();
}
