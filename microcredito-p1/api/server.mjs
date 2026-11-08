import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// API local de integración. No ejecuta operaciones monetarias reales.
const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '.local');
const dataFile = path.join(dataDir, 'demostracion.json');
const app = express();
const port = Number(process.env.PORT || 3000);
const initial = () => ({ clientes: [], solicitudes: [], eventos: [] });
fs.mkdirSync(dataDir, { recursive: true });
function readData() { if (!fs.existsSync(dataFile)) return initial(); const d=JSON.parse(fs.readFileSync(dataFile,'utf8'));return { ...initial(),...d }; }
function saveData(d) { const temp=dataFile+'.tmp';fs.writeFileSync(temp,JSON.stringify(d,null,2)); fs.renameSync(temp,dataFile); }
function safeString(x){return typeof x==='string'?x.trim():'';}
const integer = x => Number.isSafeInteger(x);
const error=(res,status,message)=>res.status(status).json({error:message});
app.use(express.json({limit:'80kb'}));
app.use((req,res,next)=>{res.set('Access-Control-Allow-Origin',process.env.CORS_ORIGIN || 'http://localhost:5173');res.set('Vary','Origin');res.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.set('Access-Control-Allow-Headers','Content-Type');if(req.method==='OPTIONS')return res.sendStatus(204);next();});
app.get('/health',(_req,res)=>res.json({status:'ok',servicio:'sgmc-api-integracion',modo:'demostracion-local',persistencia:'archivo local; PostgreSQL pendiente',operacionesFinancieras:'bloqueadas'}));
app.get('/api/health',(_req,res)=>res.json({status:'ok',servicio:'sgmc-api-integracion',modo:'demostracion-local'}));
app.post('/api/clientes',(req,res)=>{
 const {id,nombre,dpi,municipio}=req.body||{};
 if(![id,nombre,dpi,municipio].every(v=>safeString(v).length>0))return error(res,400,'Complete todos los campos del cliente.');
 if(!(/^\d{13}$/.test(dpi)||dpi==='DPI-FICT-009001'))return error(res,400,'DPI invalido.');
 const db=readData();if(db.clientes.some(c=>c.id===id))return error(res,409,'Ya existe el cliente.');
 const cli={id:safeString(id),nombre:safeString(nombre),dpi:safeString(dpi),municipio:safeString(municipio)};
 db.clientes.push(cli);saveData(db);res.status(201).json({cliente:cli,modo:'demostracion-local'});
});
app.get('/api/clientes',(_req,res)=>res.json({clientes:readData().clientes,modo:'demostracion-local'}));
function nextMonth(iso,months){const [y,m,d]=iso.split('-').map(Number);const dt=new Date(Date.UTC(y,m-1+months,1));const end=new Date(Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth()+1,0)).getUTCDate();dt.setUTCDate(Math.min(d,end));return dt.toISOString().slice(0,10);}
function simulate(b){
 const {clienteId,creditoId,asesorId,montoCentavos,tnaPorcentaje,numeroCuotas,fechaCorte}=b;
 if(!safeString(clienteId)||!safeString(creditoId)||!safeString(asesorId)||!/^\d{4}-\d{2}-\d{2}$/.test(fechaCorte||''))throw Error('Faltan identificadores o fecha de corte.');
 if(!integer(montoCentavos)||montoCentavos<100000||montoCentavos>2500000)throw Error('Monto permitido: Q1,000 a Q25,000.');
 if(!integer(numeroCuotas)||numeroCuotas<3||numeroCuotas>24)throw Error('Plazo permitido: 3 a 24 cuotas.');
 if(typeof tnaPorcentaje!=='number'||!Number.isFinite(tnaPorcentaje)||tnaPorcentaje<0||tnaPorcentaje>100)throw Error('Tasa anual fuera del rango de demostracion (0-100%).');
 const r=tnaPorcentaje/1200;const n=numeroCuotas; const pago=r===0 ? montoCentavos/n : montoCentavos*r/(1-Math.pow(1+r,-n));
 let saldo=montoCentavos;const cuotas=[];
 for(let i=1;i<=n;i++){
  const interes=Math.round(saldo*r);let capital=i===n?saldo:Math.min(saldo,Math.round(pago)-interes);
  capital=Math.max(0,capital);const cuota=capital+interes;saldo-=capital;
  cuotas.push({numero:i,fechaVencimiento:nextMonth(fechaCorte,i),cuotaCentavos:cuota,interesCentavos:interes,capitalCentavos:capital,saldoCentavos:saldo});
 }
 return {clienteId,creditoId,asesorId,montoCentavos,tnaPorcentaje,numeroCuotas,fechaCorte,cuotas,filas:cuotas,plan:cuotas,estado:'SIMULACION_NO_APROBADA',modo:'demostracion-local',nota:'Formula de cuota francesa aproximada, pendiente de cotejar con las reglas del nucleo financiero oficial. No es aprobacion ni desembolso.'};
}
app.post('/api/creditos/simular',(req,res)=>{
 try{const preview=simulate(req.body||{});const db=readData();
 if(!db.clientes.some(x=>x.id===preview.clienteId))return error(res,404,'Debe registrar primero el cliente.');
 db.solicitudes=db.solicitudes.filter(s=>s.creditoId!==preview.creditoId);db.solicitudes.push({...preview,fechaRegistro:new Date().toISOString()});saveData(db);
 res.json(preview);
 }catch(e){error(res,400,e.message)}
});
app.get('/api/solicitudes',(_req,res)=>res.json({solicitudes:readData().solicitudes.map(({cuotas,...s})=>s),modo:'demostracion-local'}));
app.get('/api/creditos/:id',(req,res)=>{const s=readData().solicitudes.find(x=>x.creditoId===req.params.id);if(!s)return error(res,404,'Credito no encontrado en simulaciones.');res.json({...s,saldoCentavos:s.montoCentavos,estado:'SIMULACION_NO_APROBADA'});});
app.get('/api/creditos/:id/plan-amortizacion',(req,res)=>{const s=readData().solicitudes.find(x=>x.creditoId===req.params.id);if(!s)return error(res,404,'Simulacion no encontrada.');res.json({cuotas:s.cuotas,modo:'demostracion-local'});});
app.get('/api/creditos/:id/amortizacion',(req,res)=>{const s=readData().solicitudes.find(x=>x.creditoId===req.params.id);if(!s)return error(res,404,'Simulacion no encontrada.');res.json({cuotas:s.cuotas,modo:'demostracion-local'});});
app.get('/api/creditos/:id/mora',(_req,res)=>error(res,501,'Mora no habilitada: requiere motor de politicas y credito aprobado.'));
app.get('/api/creditos/:id/pago-exacto',(_req,res)=>error(res,501,'Prelacion de pagos pendiente de integrar con nucleo financiero.'));
app.get('/api/cartera/resumen',(_req,res)=>res.json({carteraActivaCentavos:0,saldoCarteraCentavos:0,porcentajeRiesgo:0,porcentajeMora:0,modo:'demostracion-local',nota:'No hay creditos aprobados ni desembolsados; no representa cartera real.'}));
app.get('/api/cierres/:tipo',(req,res)=>{if(!['diario','mensual'].includes(req.params.tipo))return error(res,400,'Tipo de cierre invalido.');res.json({tipo:req.params.tipo,desembolsosCentavos:0,recuperacionesCentavos:0,saldoCarteraCentavos:0,recuperacionesPorConcepto:{gastosCentavos:0,interesMoratorioCentavos:0,interesCorrienteCentavos:0,capitalCentavos:0},modo:'demostracion-local',nota:'No se registran operaciones reales.'});});
app.post(['/api/pagos','/api/creditos/desembolsar'],(_req,res)=>error(res,403,'Operacion bloqueada: falta autorizacion y persistencia financiera transaccional.'));
app.use('/api',(_req,res)=>error(res,404,'Endpoint no implementado en el servidor de integracion.'));
app.use((err,_req,res,_next)=>error(res,400,err?.message||'Solicitud invalida.'));
app.listen(port,()=>console.log(`SGMC API DEMO: http://localhost:${port}/health`));
