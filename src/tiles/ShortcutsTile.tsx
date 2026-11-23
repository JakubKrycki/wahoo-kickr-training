export const ShortcutsTile = () => {
  return (
    <section className="panel click-controls">
      <span><kbd>↑</kbd> Increase target by 5 W</span>
      <span><kbd>↓</kbd> Decrease target by 5 W</span>
      <span><kbd>Space</kbd> Pause / resume</span>
      <span><kbd>N</kbd> Skip to next step</span>
    </section>
  );
}