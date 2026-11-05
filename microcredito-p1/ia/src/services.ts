import 'dotenv/config';
export const backend=process.env.BACKEND_URL??'http://localhost:3000/api';
/** Melany debe confirmar las rutas de este adaptador, no se han inventado respuestas. */
export async function backendCall(path:string,method='GET',body?:unknown){const response=await fetch(backend+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const raw=await response.text();let data:unknown;try{data=raw?JSON.parse(raw):null}catch{throw new Error(`Backend devolvió contenido no JSON (${response.status})`)}if(!response.ok)throw new Error(`Backend ${response.status}: ${JSON.stringify(data)}`);return data}
export const tools={
 credito:(id:string,fechaCorte:string)=>backendCall(`/creditos/${encodeURIComponent(id)}?fechaCorte=${fechaCorte}`),
 mora:(id:string,cuota:number,fechaCorte:string)=>backendCall(`/creditos/${encodeURIComponent(id)}/mora?cuota=${cuota}&fechaCorte=${fechaCorte}`),
 cartera:(fechaCorte:string)=>backendCall(`/cartera/resumen?fechaCorte=${fechaCorte}`),
 cierre:(tipo:'diario'|'mensual',fechaCorte:string)=>backendCall(`/cierres/${tipo}?fechaCorte=${fechaCorte}`),
 morosos:(tramo:string,fechaCorte:string)=>backendCall(`/cartera/morosos?tramo=${encodeURIComponent(tramo)}&fechaCorte=${fechaCorte}`),
 vencimientos:(dias:number,fechaCorte:string)=>backendCall(`/creditos/vencimientos?dias=${dias}&fechaCorte=${fechaCorte}`),
 pagoExacto:(creditoId:string,cuota:number,fechaCorte:string)=>backendCall(`/creditos/${encodeURIComponent(creditoId)}/pago-exacto?cuota=${cuota}&fechaCorte=${fechaCorte}`),
 registrarPago:(datos:unknown)=>backendCall('/pagos','POST',datos)
};
