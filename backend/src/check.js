const fs=require('node:fs'); const path=require('node:path'); const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const js=[]; function walk(d){for(const n of fs.readdirSync(d)){const p=path.join(d,n);if(n==='node_modules'||n==='.git')continue;const s=fs.statSync(p);if(s.isDirectory())walk(p);else if(n.endsWith('.js'))js.push(p)}} walk(root);
for(const f of js) execFileSync(process.execPath,['--check',f],{stdio:'inherit'});
console.log(`Syntax OK: ${js.length} JS files.`);
