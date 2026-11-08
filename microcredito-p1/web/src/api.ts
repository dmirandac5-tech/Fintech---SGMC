/** Contrato PROVISIONAL: Melany debe confirmar rutas y tipos en docs/CONTRATO-INTEGRACION.md */
const base = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
export const corteDefault = '2026-10-31';
export async function api<T=unknown>(path:string, init:RequestInit={}) : Promise<T> {
 const metodo = (init.method ?? 'GET').toUpperCase();
 if (metodo === 'POST' && (
   path === '/pagos' ||
   path === '/creditos/desembolsar'
 )) {
   throw new Error(
     'Operacion financiera temporalmente deshabilitada. Pendiente de autenticacion y autorizacion del backend.'
   );
 }
 const response=await fetch(`${base}${path}`, { ...init, headers:{'Content-Type':'application/json', ...(init.headers||{})} });
 const text=await response.text();
 let data:unknown; try {data=text?JSON.parse(text):null} catch { throw Error(`Respuesta no JSON (${response.status})`); }
 if(!response.ok) { const err=data as {message?:string;error?:string; montoCorrecto?:number}|null;
   throw Error([err?.message||err?.error||`HTTP ${response.status}`, err?.montoCorrecto!==undefined?`Monto correcto: ${err.montoCorrecto}`:''].filter(Boolean).join(' — ')); }
 return data as T;
}
export function query(path:string,params:Record<string,string>){return `${path}?${new URLSearchParams(params).toString()}`}
