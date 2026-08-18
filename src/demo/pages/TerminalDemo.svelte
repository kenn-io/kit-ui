<script lang="ts">
  import DemoSection from "../DemoSection.svelte";
  import { XtermTerminalPane, type TerminalTransport } from "../../lib/terminal/index.js";

  // In-page echo transport: no server involved. It opens asynchronously,
  // greets, and echoes typed bytes back (CR expanded to CRLF), which is
  // enough to exercise the pane's rendering, input, resize, and paste paths.
  function echoTransport(): TerminalTransport {
    const encoder = new TextEncoder();
    return {
      capabilities: { supportsReplayBoundary: false },
      connect(request, handlers) {
        let closed = false;
        const timer = setTimeout(() => {
          handlers.onOpen();
          const size = request.size ? `${request.size.cols}x${request.size.rows}` : "unmeasured";
          handlers.onData(
            encoder.encode(`\x1b[1mkit-ui terminal demo\x1b[0m (echo transport, ${size})\r\n> `),
          );
        }, 0);
        return {
          send(data) {
            if (closed) return;
            let text = new TextDecoder().decode(data);
            typedInput += text;
            text = text.replaceAll("\r", "\r\n> ");
            handlers.onData(encoder.encode(text));
          },
          sendControl() {},
          close() {
            if (closed) return;
            closed = true;
            clearTimeout(timer);
            handlers.onClose({ opened: true });
          },
        };
      },
    };
  }

  const transport = echoTransport();
  let connected = $state(false);
  let lastError = $state("");
  let typedInput = $state("");
</script>

<DemoSection
  title="Xterm terminal pane"
  description="XtermTerminalPane renders an xterm.js terminal against any TerminalTransport — here an in-page echo transport. Hosts own the transport (websocket, relay, fake); the pane owns rendering, input, clipboard gating, resize authority, and reconnect presentation. Import from @kenn-io/kit-ui/terminal (not the root barrel); @xterm/* are optional peer dependencies."
  code={`import { XtermTerminalPane, webSocketTerminalTransport } from "@kenn-io/kit-ui/terminal";

const transport = webSocketTerminalTransport({
  url: (request) => buildTerminalUrl(request),
  capabilities: { supportsReplayBoundary: false },
});`}
>
  <div class="host">
    <XtermTerminalPane
      {transport}
      settings={{ fontSize: 13 }}
      autoFocus={false}
      onConnectionChange={(value) => (connected = value)}
      onError={(error) => (lastError = error.kind)}
    />
  </div>
  <p class="note">
    connected: <code data-test="connected">{connected}</code>
    · input seen by transport: <code data-test="typed-input">{typedInput}</code>
    {#if lastError}
      · last error: <code>{lastError}</code>
    {/if}
  </p>
</DemoSection>

<style>
  .host {
    height: 260px;
    overflow: hidden;
    border: var(--border-width) solid var(--border-muted);
    border-radius: var(--radius-md);
  }

  .note {
    margin-top: var(--space-4);
    color: var(--text-muted);
    font-size: var(--font-size-sm);
  }
</style>
