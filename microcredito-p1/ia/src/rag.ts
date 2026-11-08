import 'dotenv/config';
import pg from 'pg';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const ollama=process.env.OLLAMA_URL??'http://localhost:11434';
const model=process.env.EMBEDDING_MODEL??'bge-m3';
export async function embedding(text:string):Promise<number[]>{const r=await fetch(`${ollama}/api/embed`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,input:text})});if(!r.ok)throw Error(`Ollama embedding: HTTP ${r.status}`);const j=await r.json() as {embeddings?:number[][]};if(!j.embeddings?.[0])throw Error('Ollama no devolvió embedding');return j.embeddings[0]}
export async function prepare(){await pool.query('CREATE EXTENSION IF NOT EXISTS vector');await pool.query(`CREATE TABLE IF NOT EXISTS rag_fragmentos(id bigserial primary key,fuente text not null,fragmento text not null, embedding vector(1024) not null, UNIQUE(fuente,fragmento))`)}
export async function recover(pregunta:string,limit=4){const e=await embedding(pregunta);if(e.length!==1024)throw Error(`Dimensión ${e.length} no coincide con bge-m3 (1024)`);const vector=`[${e.join(',')}]`;const result=await pool.query<{fuente:string;fragmento:string;distancia:number}>('SELECT fuente,fragmento,embedding <=> $1::vector AS distancia FROM rag_fragmentos ORDER BY embedding <=> $1::vector LIMIT $2',[vector,limit]);return result.rows}
export async function close(){await pool.end()}
