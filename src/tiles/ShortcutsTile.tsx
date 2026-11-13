export const ShortcutsTile = () => {
  return (
    <section className="panel click-controls">
      <div>
        <div className="eyebrow">PHYSICAL CONTROLS · ZWIFT CLICK V2</div>
        <h3>Button shortcuts</h3>
        <p>
          Keep your Zwift Click mapper running and configure its
          output keys as shown below. Keep this browser tab focused
          while riding.
        </p>
      </div>

      <div className="shortcut-grid">
        <span><kbd>↑</kbd> Increase target by 5 W</span>
        <span><kbd>↓</kbd> Decrease target by 5 W</span>
        <span><kbd>Space</kbd> Pause / resume</span>
        <span><kbd>N</kbd> Skip to next step</span>
      </div>

      <small>
        Keyboard controls are ignored while typing in form fields.
      </small>
    </section>
  );
}