<script lang="ts">
  import { Avatar } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  // A drawn portrait as a data URI, so the gallery needs no network.
  const portrait =
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#7c9cbf"/><circle cx="32" cy="25" r="12" fill="#f1d3b8"/><path d="M10 64c2-14 11-21 22-21s20 7 22 21z" fill="#2f4d6b"/><path d="M20 23c0-9 6-14 12-14s12 5 12 14c-3-5-8-7-12-7s-9 2-12 7z" fill="#3b2a20"/></svg>`,
    );

  const people = [
    { name: "Ada Lovelace", key: "user-1" },
    { name: "Grace Hopper", key: "user-2" },
    { name: "Katherine Johnson", key: "user-3" },
    { name: "Alan Turing", key: "user-4" },
    { name: "jane.doe@example.com", key: "user-5" },
    { name: "Linus", key: "user-6" },
  ];

  const sizes = [16, 20, 24, 32, 40];
</script>

<DemoSection
  title="Initials"
  description="Without a picture the avatar shows one or two initials on a tint of an accent picked from colorKey, so the same person keeps the same color everywhere. An email address uses its local part."
  code={`<Avatar name="Ada Lovelace" colorKey={user.id} />
<Avatar name="jane.doe@example.com" />`}
>
  <div class="row" data-testid="avatar-initials">
    {#each people as person (person.key)}
      <Avatar name={person.name} colorKey={person.key} size={32} />
    {/each}
  </div>
</DemoSection>

<DemoSection
  title="Picture with a fallback"
  description="Pass src for a picture. When it is missing or fails to load, the initials show instead."
  code={`<Avatar name="Ada Lovelace" src={user.avatarUrl} />`}
>
  <div class="row" data-testid="avatar-picture">
    <Avatar name="Ada Lovelace" src={portrait} size={40} />
    <Avatar name="Grace Hopper" colorKey="user-2" src="/missing-avatar.png" size={40} />
    <Avatar name="Alan Turing" colorKey="user-4" src={null} size={40} />
  </div>
</DemoSection>

<DemoSection
  title="Sizes"
  description="size is in pixels. The initials scale with the box."
  code={`<Avatar name="Grace Hopper" size={16} />`}
>
  <div class="row" data-testid="avatar-sizes">
    {#each sizes as size (size)}
      <Avatar name="Grace Hopper" colorKey="user-2" {size} />
    {/each}
  </div>
</DemoSection>

<DemoSection
  title="Shapes and tones"
  description="Circles are for people. rounded and square tell an organization or a domain apart, with initials set to one letter. tone neutral is a plain grey tile for lists where color would compete with the content."
  code={`<Avatar name="example.com" shape="square" initials="E" />
<Avatar name="Ada Lovelace" tone="neutral" />`}
>
  <div class="row" data-testid="avatar-shapes">
    <Avatar name="Ada Lovelace" colorKey="user-1" size={32} />
    <Avatar name="Ada Lovelace" colorKey="user-1" shape="rounded" size={32} />
    <Avatar name="example.com" initials="E" shape="square" size={32} />
    <Avatar name="Ada Lovelace" tone="neutral" size={32} />
    <Avatar name="Add a reviewer" initials="@" tone="neutral" size={32} />
  </div>
</DemoSection>

<DemoSection
  title="Beside a name"
  description="The avatar's accessible name is name. When the name is already written next to it, set decorative so screen readers do not hear it twice."
  code={`<Avatar name={author} decorative size={20} /> <span>{author}</span>`}
>
  <ul class="list" data-testid="avatar-list">
    {#each people.slice(0, 3) as person (person.key)}
      <li>
        <Avatar name={person.name} colorKey={person.key} decorative size={20} />
        <span>{person.name}</span>
      </li>
    {/each}
  </ul>
</DemoSection>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }

  .list {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .list li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-primary);
    font-size: var(--font-size-sm);
  }
</style>
