const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/ui-review/rebuild-contract.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('rebuild retains every application shell hook exactly once', () => {
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
  for (const id of contract.requiredShellIds) assert.equal(ids.filter(value => value === id).length, 1, `${id} missing or duplicated`);
  for (const screen of contract.screens) assert.ok(ids.includes(`screen-${screen}`), `Lost ${screen} screen`);
});

test('rebuild preserves protected content, authentication and engine files', () => {
  const backup = path.join(root, contract.backup);
  function compare(relative) {
    const current = path.join(root, relative);
    const previous = path.join(backup, relative);
    assert.ok(fs.existsSync(current), `Missing ${relative}`);
    // The UI backup contains only the files touched by the redesign. Files
    // outside that backup are checked for presence and loading below.
    if (!fs.existsSync(previous)) return;
    if (fs.statSync(previous).isDirectory()) {
      for (const name of fs.readdirSync(previous)) compare(path.join(relative, name));
    } else {
      assert.ok(fs.readFileSync(current).equals(fs.readFileSync(previous)), `Protected file changed: ${relative}`);
    }
  }
  for (const relative of contract.preserveModules) compare(relative);
  for (const script of ['auth.js', 'secure-api.js', 'engine/content-loader.js', 'engine/practice-engine.js', 'engine/mistake-notebook.js', 'engine/route-manager.js', 'engine/checkpoints.js']) {
    assert.ok(html.includes(`src="${script}?`), `Required feature script no longer loaded: ${script}`);
  }
});
