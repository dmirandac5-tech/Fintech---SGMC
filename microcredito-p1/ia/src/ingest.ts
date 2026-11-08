import { readFile,readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { embedding,prepare,close } from './rag.js';
import 'dotenv/config';
const dir=resolve(process.env.CORPUS_DIR??'../datos-proyecto-final/corpus');
function chunks(s:string,size=1200,overlap=150){const out:string[]=[];for(let i=0;i<s.length;i+=size-overlap)out.push(s.slice(i,i+size));return out.filter(x=>x.trim())}
await prepare();const client=new pg.Client({connectionString:process.env.DATABASE_URL});await client.connect();try{const files=(await readdir(dir)).filter(f=>f.endsWith('.md')).sort();if(files.length!==7)throw Error(`Se esperaban 7 documentos en ${dir}, hay ${files.length}`);for(const file of files){const content=await readFile(resolve(dir,file),'utf8');for(const fragmento of chunks(content)){const e=await embedding(fragmento);if(e.length!==1024)throw Error('Dimensión de embedding inesperada');await client.query('INSERT INTO rag_fragmentos (fuente,fragmento,embedding) VALUES ($1,$2,$3::vector) ON CONFLICT(fuente,fragmento) DO NOTHING',[file,fragmento,`[${e.join(',')}]`])}console.log(`Documento procesado: ${file}`)}console.log('RAG: los 7 documentos se procesaron (inserción idempotente)')}finally{await client.end();await close()}
