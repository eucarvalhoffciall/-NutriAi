const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/analyze-meal.js');
const sample = {foodRecognized:true,title:'Arroz e frango',portion:'1 prato',confidence:'medium',calories:510,protein:35,carbs:62,fat:14,items:[{name:'Frango',portion:'100 g'}],note:'Porção estimada.'};
async function call(body) {
 let result;
 const res = {status(n){this.code=n;return this;},setHeader(){},json(data){result={status:this.code,body:data};}};
 await handler({method:'POST',headers:{host:'localhost',origin:'http://localhost','x-forwarded-for':String(Math.random())},body},res);
 return result;
}
test('photo reaches OpenAI server-side and validated nutrition reaches client', async () => {
 const originalFetch=global.fetch, originalKey=process.env.OPENAI_API_KEY;
 process.env.OPENAI_API_KEY='test-only-placeholder';
 let sent;
 global.fetch=async (url,options)=> {assert.equal(url,'https://api.openai.com/v1/chat/completions');sent=JSON.parse(options.body);return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(sample)}}]})};};
 try {
 const result=await call({image:'data:image/jpeg;base64,/9j/2Q==',language:'pt-PT'});
 assert.equal(result.status,200);assert.equal(result.body.calories,510);
 assert.equal(sent.messages[1].content[1].type,'image_url');assert.equal(sent.store,false);
 assert.equal(sent.response_format.json_schema.strict,true);
 assert.equal(JSON.stringify(result).includes('test-only-placeholder'),false);
 } finally {global.fetch=originalFetch;if(originalKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=originalKey;}
});
test('provider quota and malformed result do not produce fabricated nutrients', async()=>{
 const originalFetch=global.fetch,originalKey=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-only-placeholder';
 try {
 global.fetch=async()=>({ok:false,status:429,json:async()=>({error:{code:'insufficient_quota'}})});
 let result=await call({description:'Sopa'});assert.equal(result.status,503);assert.match(result.body.error,/saldo/);assert.equal(result.body.calories,undefined);
 global.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:'{"calories":-200}'}}]})});
 result=await call({description:'Sopa'});assert.equal(result.status,503);assert.equal(result.body.calories,undefined);
 }finally{global.fetch=originalFetch;if(originalKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=originalKey;}
});
