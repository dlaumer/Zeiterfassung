import assert from 'node:assert/strict';
import { build } from 'esbuild';
import * as XLSX from 'xlsx';
const bundle = await build({entryPoints:['src/admin/subjectImport.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {parseSubjectImportRows} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
for (const bookType of ['xlsx','xls']) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet([
    {'Key':'math','Modulname':'Mathematik','ECTS':4.5,'LE-Nummer':'001-123'},
    {'Key':'MATH','Modulname':'Duplicate','ECTS':3},
    {'Module name':'English module','Credits':2},
    {'Key':'missing-label'},
  ]),'Modules');
  const rows = await parseSubjectImportRows(XLSX.write(book,{type:'array',bookType}));
  assert.deepEqual(rows,[
    {number:'001-123',key:'math',label:'Mathematik',credits:4.5},
    {number:'',key:'English module',label:'English module',credits:2},
  ]);
}
console.log('PASS: XLS/XLSX module imports with upgraded SheetJS, aliases, decimal credits, leading zeros and duplicate filtering');
