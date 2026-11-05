import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { tools } from './services.js';
const server=new McpServer({name:'credito-vecino-mcp',version:'0.1.0'});
const fecha=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Fecha YYYY-MM-DD obligatoria');
const read=(data:unknown)=>({content:[{type:'text' as const,text:JSON.stringify(data)}]});
server.tool('consultar_credito','Consulta un crédito con fecha de corte',{id:z.string(),fechaCorte:fecha},async a=>read(await tools.credito(a.id,a.fechaCorte)));
server.tool('explicar_mora','Devuelve tramos de mora calculados por el núcleo',{id:z.string(),cuota:z.number().int().positive(),fechaCorte:fecha},async a=>read(await tools.mora(a.id,a.cuota,a.fechaCorte)));
server.tool('consultar_cartera','Cartera activa, mora, riesgo e incobrables',{fechaCorte:fecha},async a=>read(await tools.cartera(a.fechaCorte)));
server.tool('consultar_cierre','Cierre por fecha de corte',{tipo:z.enum(['diario','mensual']),fechaCorte:fecha},async a=>read(await tools.cierre(a.tipo,a.fechaCorte)));
server.tool('listar_morosos','Morosos por tramo',{tramo:z.string(),fechaCorte:fecha},async a=>read(await tools.morosos(a.tramo,a.fechaCorte)));
server.tool('proximos_vencimientos','Vencimientos desde fecha de corte',{dias:z.number().int().positive(),fechaCorte:fecha},async a=>read(await tools.vencimientos(a.dias,a.fechaCorte)));
server.tool('consultar_pago_exacto','Consulta pago exigible SIN efectuarlo',{creditoId:z.string(),cuota:z.number().int().positive(),fechaCorte:fecha},async a=>read(await tools.pagoExacto(a.creditoId,a.cuota,a.fechaCorte)));
// No exponemos registrarPago como herramienta de escritura autónoma.
// Los pagos se proponen desde el servidor HTTP y requieren autorización explícita humana.
const transport=new StdioServerTransport();await server.connect(transport);
