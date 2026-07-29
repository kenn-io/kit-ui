<script lang="ts">
  import { FormField, type FieldState } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let email = $state<FieldState>({
    id: "form-field-demo-email",
    label: "Work email",
    value: "name@",
    error: "Enter a complete email address.",
  });
  let inputCallbacks = $state(0);
  let blurCallbacks = $state(0);

  function updateEmail(value: string) {
    inputCallbacks += 1;
    email = { ...email, value, error: undefined };
  }
</script>

<DemoSection
  title="FormField"
  description="A persistent label and accessible error message around the shared large TextInput control. Applications own validation and field state."
  code={`<FormField field={email} type="email" required oninput={updateEmail} />`}
>
  <div class="form-field-demo">
    <FormField
      field={email}
      type="email"
      required
      autocomplete="email"
      oninput={updateEmail}
      onblur={() => (blurCallbacks += 1)}
    />
    <div class="form-field-demo__readout" aria-live="polite">
      <span data-testid="auth-field-value">{email.value}</span>
      <span data-testid="auth-input-callbacks">{inputCallbacks}</span>
      <span data-testid="auth-blur-callbacks">{blurCallbacks}</span>
    </div>
  </div>
</DemoSection>

<style>
  .form-field-demo {
    width: min(100%, 420px);
  }

  .form-field-demo__readout {
    display: none;
  }
</style>
