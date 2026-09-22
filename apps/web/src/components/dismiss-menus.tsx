'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Closes an open overlay menu when you click away from it, press Escape, or
 * navigate.
 *
 * The menus are native `<details>`, which is how they keep working before the
 * client bundle arrives and without JavaScript at all. What `<details>` does
 * not do is close when you click somewhere else — it is a disclosure widget,
 * not a menu — so the society switcher and the account menu stayed open over
 * the page until you clicked the summary again. On a phone, where the menu
 * covers what you were trying to tap, that reads as the app being stuck.
 *
 * Mounted once in the layout and driven by a `data-menu` attribute rather than
 * by wrapping each menu, so this stays a behaviour rather than a component
 * every future menu has to remember to use — and so the menus themselves stay
 * server components.
 *
 * Deliberately not applied to every `<details>` in the app. An accordion is
 * supposed to stay open: the comment thread, "Who voted", the tower groups on
 * the flats page and the correct-a-bill forms are all inline disclosures, and
 * closing them because somebody clicked the page would lose whatever they were
 * halfway through typing. Only the two that float above the page dismiss.
 */
export function DismissMenus() {
  const pathname = usePathname();

  // Closing after the route changes covers a link inside the menu, which is
  // most of what these menus contain.
  useEffect(() => {
    for (const menu of document.querySelectorAll<HTMLDetailsElement>('details[data-menu][open]')) {
      menu.open = false;
    }
  }, [pathname]);

  useEffect(() => {
    const open = () => document.querySelectorAll<HTMLDetailsElement>('details[data-menu][open]');

    /** Closes every open menu that does not contain `inside`. */
    const closeExcept = (inside: Node | null) => {
      for (const menu of open()) {
        if (!inside || !menu.contains(inside)) menu.open = false;
      }
    };

    // pointerdown rather than click: the menu should be gone by the time the
    // thing underneath reacts, and a click that starts inside and drags out
    // is not a dismissal.
    const onPointerDown = (event: PointerEvent) => closeExcept(event.target as Node);

    // A link to the page you are already on does not change the pathname, and
    // a form inside the menu (switch view, sign out) posts without one either.
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('a, button[type="submit"]')) closeExcept(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const menus = [...open()];
      if (menus.length === 0) return;
      // Escape belongs to the menu, not to whatever else is listening.
      event.preventDefault();
      // Focus goes back to the control that opened it, or it lands on <body>
      // and a keyboard user starts again from the top of the page.
      menus[menus.length - 1]?.querySelector('summary')?.focus();
      closeExcept(null);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return null;
}
