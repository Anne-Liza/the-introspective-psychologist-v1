import type { SidebarNavigationSection } from "./navigation";

export function filterNavigationSections(
  sections: SidebarNavigationSection[],
  hasPermission: (permission: string) => boolean,
): SidebarNavigationSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const hasRequiredPermission =
          !item.permission ||
          hasPermission(item.permission);

        const hasExcludedPermission =
          Boolean(item.exclude_permission) &&
          hasPermission(item.exclude_permission!);

        return (
          hasRequiredPermission &&
          !hasExcludedPermission
        );
      }),
    }))
    .filter((section) => section.items.length > 0);
}
