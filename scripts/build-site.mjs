import {mkdir,cp,writeFile,readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
const root=process.cwd(),out=join(root,'dist');
await mkdir(out,{recursive:true});
for(const name of ['index.html','styles.css','manifest.webmanifest','src','assets','content']){
  await cp(join(root,name),join(out,name),{recursive:true,force:true});
}
await writeFile(join(out,'.nojekyll'),'');
const html=await readFile(join(out,'index.html'),'utf8');
if(!html.includes('src/app.js')||!html.includes('styles.css'))throw Error('Missing game entrypoints');
for(const folder of ['src','assets','content']){
 if(!(await readdir(join(out,folder))).length)throw Error('Missing files in '+folder);
}
console.log('Pages artifact ready: dist/ (no .git, tests, docs or internal reports)');
