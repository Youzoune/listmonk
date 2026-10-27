// Builds the mock-up into a single HTML page: bun ./build.mjs
// React and ReactDOM are globals loaded from cdnjs by the page.
const dir = import.meta.dir;

const out = await Bun.build({
  entrypoints: [`${dir}/src/main.jsx`],
  format: 'iife',
  minify: true,
  tsconfig: `${dir}/jsconfig.json`,
});
if (!out.success) {
  for (const log of out.logs) console.error(log);
  process.exit(1);
}

const js = await out.outputs[0].text();
const tpl = await Bun.file(`${dir}/template.html`).text();
await Bun.write(`${dir}/relais.html`, tpl.replace('/*APP*/', () => js.replaceAll('</script', '<\\/script')));
console.log(`relais.html: ${(js.length / 1024).toFixed(1)} kB of app code`);
