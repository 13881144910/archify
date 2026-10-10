import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test('Hermes discovery describes all ten supported diagram modes', () => {
 const plugin=fileURLToPath(new URL('../__init__.py',import.meta.url));
 const python=process.env.PYTHON || (process.platform==='win32'?'py':'python3');
 const args=!process.env.PYTHON && process.platform==='win32'?['-3']:[];
 const run=spawnSync(python,[...args,'-c',`import importlib.util\nfrom types import SimpleNamespace\nspec=importlib.util.spec_from_file_location('archify', ${JSON.stringify(plugin)})\nmod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)\nmod.register(SimpleNamespace(register_skill=lambda *a, **kw: print(kw['description'])))`],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 for(const mode of ['architecture','workflow','sequence','data-flow','lifecycle','ERD','class','tree','timeline','waterfall']) assert.match(run.stdout,new RegExp(`\\b${mode}\\b`,'i'),mode);
});
