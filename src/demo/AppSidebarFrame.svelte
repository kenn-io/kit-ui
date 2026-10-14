<script lang="ts">
  // The sample app inside the AppSidebar gallery iframes and browser tests:
  // ?app-sidebar-frame=<section>[/<view>] picks the current location,
  // ?app-sidebar-footer=none renders the sidebar without a footer, and
  // ?app-sidebar-labels=es names every control in Spanish.
  import FileTextIcon from "@lucide/svelte/icons/file-text";
  import HouseIcon from "@lucide/svelte/icons/house";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import type { ComponentProps } from "svelte";
  import { AppSidebar, ThemeToggle, type SidebarGroup } from "../lib/index.js";

  const PARAM = "app-sidebar-frame";
  const link = (route: string) => `${location.pathname}?${PARAM}=${route}`;
  const params = new URLSearchParams(location.search);
  const withFooter = params.get("app-sidebar-footer") !== "none";
  const labels: Partial<ComponentProps<typeof AppSidebar>> =
    params.get("app-sidebar-labels") === "es"
      ? {
          label: "Navegación principal",
          menuLabel: "Abrir navegación",
          drawerLabel: "Navegación",
          expandLabel: "Expandir barra lateral",
          collapseLabel: "Contraer barra lateral",
        }
      : {};

  const groups: SidebarGroup[] = [
    {
      label: null,
      sections: [{ id: "home", label: "Home", href: link("home"), icon: HouseIcon, viewRuns: [] }],
    },
    {
      label: "Workspace",
      sections: [
        {
          id: "reports",
          label: "Reports",
          href: link("reports/overview"),
          icon: FileTextIcon,
          viewRuns: [
            {
              heading: null,
              views: [
                { id: "overview", label: "Overview", href: link("reports/overview") },
                { id: "history", label: "History", href: link("reports/history") },
              ],
            },
            {
              heading: "Archive",
              views: [{ id: "archived", label: "Archived", href: link("reports/archived") }],
            },
          ],
        },
        {
          id: "settings",
          label: "Settings",
          href: link("settings"),
          icon: SettingsIcon,
          viewRuns: [],
        },
      ],
    },
  ];

  let address = $state(new URL(location.href));
  const route = $derived((address.searchParams.get(PARAM) || "home").split("/"));
  const where = $derived({ section: route[0] ?? null, view: route[1] ?? null });
  const page = $derived(address.pathname + address.search);
  const sectionLabel = $derived(
    groups.flatMap((group) => group.sections).find((section) => section.id === where.section)
      ?.label ?? "",
  );

  /** Same-document navigation for the sample app's links. */
  function follow(event: MouseEvent): void {
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (event.defaultPrevented || event.button !== 0 || modified) return;
    const anchor = event.target instanceof Element ? event.target.closest("a") : null;
    if (!anchor || anchor.origin !== location.origin) return;
    event.preventDefault();
    history.pushState(null, "", anchor.href);
    address = new URL(location.href);
  }
</script>

<svelte:document onclick={follow} />
<svelte:window onpopstate={() => (address = new URL(location.href))} />

{#snippet themeFooter({ rail }: { rail: boolean; drawer: boolean })}
  <ThemeToggle size={rail ? "md" : "sm"} />
{/snippet}

<div class="frame">
  <AppSidebar
    {...labels}
    {groups}
    location={where}
    {page}
    storageKey="kit-ui-demo-app-sidebar"
    footer={withFooter ? themeFooter : undefined}
  >
    {#snippet brand({ rail })}
      <a class="frame__brand" href={link("home")} aria-label="Acme">{rail ? "A" : "Acme"}</a>
    {/snippet}
    {#snippet narrowBar()}
      <a class="frame__brand" href={link("home")}>Acme</a>
      <span class="frame__where">{sectionLabel}</span>
    {/snippet}
  </AppSidebar>
  <main class="frame__main">
    <h1 class="frame__title">{sectionLabel}</h1>
    <p>Sample page. Resize the window to move between the drawer, the rail and the full sidebar.</p>
  </main>
</div>

<style>
  .frame {
    display: flex;
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .frame__main {
    flex: 1;
    min-width: 0;
    padding: var(--space-7);
  }

  .frame__brand {
    color: var(--text-primary);
    font-weight: var(--font-weight-semibold, 600);
    text-decoration: none;
  }

  .frame__where {
    color: var(--text-secondary);
  }

  .frame__title {
    margin: 0 0 var(--space-5);
    font-size: var(--font-size-xl);
  }

  @media (max-width: 900px) {
    .frame {
      flex-direction: column;
    }
  }
</style>
