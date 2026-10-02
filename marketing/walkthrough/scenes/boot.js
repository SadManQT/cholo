(async () => {
  CLIPS = await (await fetch('clips/clips.json')).json();
  build();
  await document.fonts.ready;
  await Promise.all([...document.images].filter((i) => i.src).map((i) => i.decode().catch(() => {})));
  window.READY = true; await render(0);
})();
