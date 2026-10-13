const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
const m={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/inventario/cart.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(m,m.exports);
const {validateCart}=m.exports,c={id:'c',code:'001.308',unit:'pz',lots:[{id:'a',name:'A',expiry:'2027-01-01',stock:{aprobado:100}},{id:'b',name:'B',expiry:'2025-01-01',stock:{aprobado:50}}]},line={componentId:'c',lotId:'a',quantity:30,origin:'aprobado',destination:'externo:produccion'};
assert.doesNotThrow(()=>validateCart([line,{...line,quantity:70}],[c],'salida','2026-10-13'));
assert.throws(()=>validateCart([line,{...line,quantity:71}],[c],'salida','2026-10-13'),/insuficiente/);
assert.throws(()=>validateCart([line,{...line,origin:'terminado'}]),/único origen/);
assert.throws(()=>validateCart([line,{...line,destination:'externo:envio'}]),/único origen/);
assert.throws(()=>validateCart([{...line,lotId:''}]),/lotes seleccionados/);
assert.throws(()=>validateCart([{...line,lotId:'b'}],[c],'salida','2026-10-13'),/vencido/);
assert.throws(()=>validateCart([{...line,quantity:0.5}],[c],'salida','2026-10-13'),/enteras/);
assert.doesNotThrow(()=>validateCart([{...line,quantity:200,origin:'externo:recepcion',destination:'aprobado'}],[c],'entrada','2026-10-13'));
assert.throws(()=>validateCart([], [c]),/Agrega/);
console.log('Common origin/destination, explicit lots, cumulative quantities, expiry and return cart validation passed.');

assert.doesNotThrow(()=>validateCart([{...line,quantity:0.1},{...line,quantity:0.2}],[{...c,unit:"L",lots:[{...c.lots[0],stock:{aprobado:0.3}}]}],"salida","2026-10-13"));

const {cartLotAvailability}=m.exports;
assert.equal(cartLotAvailability(c,'a',[line],'aprobado','salida','2026-10-13').available,70);
assert.equal(cartLotAvailability(c,'b',[],'aprobado','salida','2026-10-13').selectable,false);
assert.equal(cartLotAvailability(c,'a',[],'pendiente','salida','2026-10-13').selectable,false);
assert.equal(cartLotAvailability(c,'b',[],'externo:recepcion','entrada','2026-10-13').selectable,true);
assert.equal(cartLotAvailability(c,'a',[{...line,quantity:100}],'aprobado','salida','2026-10-13').selectable,false);
console.log('Lot picker availability accounts for the cart, origin, expiry and return movements.');
