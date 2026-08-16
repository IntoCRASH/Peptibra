import postgres from "postgres";
let client:ReturnType<typeof postgres>|null=null;
const sqlClient=()=>client??=(postgres(process.env.POSTGRES_URL!,{ssl:"require",max:5}));
const pg=(text:string)=>{let n=0;return text.replace(/\?/g,()=>`$${++n}`)};
class Statement{args:any[]=[];constructor(public text:string){}bind(...args:any[]){this.args=args;return this}async all(){const rows=await sqlClient().unsafe(pg(this.text),this.args);return{results:[...rows]}}async first<T>(){const rows=await sqlClient().unsafe(pg(this.text),this.args);return(rows[0] as T|undefined)??null}async run(){let query=pg(this.text);if(/^\s*insert\s/i.test(query)&&!/\breturning\b/i.test(query))query+=" RETURNING id";const rows=await sqlClient().unsafe(query,this.args);return{meta:{last_row_id:Number(rows[0]?.id||0),changes:rows.count??0}}}}
export const pgDb={prepare:(text:string)=>new Statement(text),batch:async(items:Statement[])=>Promise.all(items.map(x=>x.run()))};
export const allRows=async(text:string,...args:unknown[])=>(await pgDb.prepare(text).bind(...args).all()).results;

