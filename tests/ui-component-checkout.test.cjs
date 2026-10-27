const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
test('fixed component bytes survive the explicit LF checkout contract',()=>{
 const lock=JSON.parse(fs.readFileSync(path.join(root,'components/ui-conventions.lock.json'),'utf8'));
 for(const name of ['ui-conventions.js','ui-conventions.css']){
  const relative='components/'+name,bytes=fs.readFileSync(path.join(root,relative));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),lock.files[name],relative+' pinned bytes');
  assert.match(cp.execFileSync('git',['check-attr','eol','--',relative],{cwd:root,encoding:'utf8'}),/: eol: lf\s*$/,relative+' must stay LF in fresh Windows checkouts');
 }
});
