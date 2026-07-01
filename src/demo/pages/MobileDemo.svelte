<script lang="ts">
  import DemoSection from "../DemoSection.svelte";

  // The iframes load this same demo app with ?mobile-frame, which renders
  // MobileFrame.svelte instead of the gallery shell. The type scale keys on
  // the device's pointer (a handheld touch device), not viewport width — an
  // iframe inherits the host's pointer, so the phone frame adds &touch to
  // force the scale via the kit-type-touch root class, the same way a test
  // or device emulator would.
  const frameSrc = `${location.pathname}?mobile-frame`;
  const touchFrameSrc = `${frameSrc}&touch`;
</script>

<DemoSection
  title="Touch vs desktop, same tokens"
  description="Both frames render the identical sample screen. On a real handheld ((hover: none) and (pointer: coarse)) the token ladder itself resizes — body text 13px → 16px, titles 18px → 20px — with zero media queries in any component; the phone frame emulates that via the kit-type-touch class. Narrowing a desktop window does NOT resize text: type responds to input modality and reading distance, layout responds to width. The 16px inputs also stop iOS Safari from auto-zooming on focus."
  code={`/* theme.css owns the swap; components just use tokens */
--font-size-md: 0.8125rem;              /* 13px desktop */
@media (hover: none) and (pointer: coarse) {
  :root { --font-size-md: 1rem; }       /* 16px on handheld touch devices */
}
/* force it in tests/emulation: <html class="kit-type-touch"> */`}
>
  <div class="frames">
    <figure class="frame">
      <div class="frame__device frame__device--phone">
        <iframe src={touchFrameSrc} title="Sample screen on an emulated touch device (touch type scale)"></iframe>
      </div>
      <figcaption>375px, touch scale (kit-type-touch)</figcaption>
    </figure>
    <figure class="frame">
      <div class="frame__device frame__device--desktop">
        <iframe src={frameSrc} title="Sample screen on desktop (base type scale)"></iframe>
      </div>
      <figcaption>720px — desktop scale</figcaption>
    </figure>
  </div>
</DemoSection>

<style>
  .frames {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    align-items: flex-start;
  }

  .frame {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .frame__device {
    border: 6px solid var(--text-primary);
    border-radius: 18px;
    overflow: hidden;
    background: var(--bg-primary);
  }

  .frame__device--phone {
    width: 375px;
    height: 560px;
  }

  .frame__device--desktop {
    width: 720px;
    max-width: 100%;
    height: 560px;
    border-radius: 10px;
    border-width: 4px;
  }

  .frame__device iframe {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
  }

  figcaption {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    text-align: center;
  }
</style>
