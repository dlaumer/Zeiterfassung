import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ComposedChart, Bar, XAxis, YAxis } from 'recharts';
import assert from 'node:assert/strict';
const h = React.createElement;
const shapes = [];
const shape = kind => props => { shapes.push({kind,...props}); return h('rect', {x:props.x,y:Math.min(props.y,props.y+props.height),width:props.width,height:Math.abs(props.height)}); };
renderToStaticMarkup(h(ComposedChart, {width:800,height:500,barGap:-110,barSize:110,data:[{label:'A',hours:10,rating:1},{label:'B',hours:5,rating:5}],margin:{top:16,bottom:16,left:0,right:4}},
 h(XAxis,{dataKey:'label',height:30}),h(YAxis,{domain:[0,12],padding:{top:108.5},width:64}),h(YAxis,{yAxisId:'ratings',orientation:'right',domain:[0,5],reversed:true,ticks:[1,2,3,4,5],padding:{bottom:347.2},width:36}),
 h(Bar,{dataKey:'hours',stackId:'hours',maxBarSize:110,isAnimationActive:false,shape:shape('hours')}),h(Bar,{dataKey:'rating',yAxisId:'ratings',maxBarSize:110,isAnimationActive:false,shape:shape('rating')})));
for(let i=0;i<2;i++) {
 const work=shapes.filter(x=>x.kind==='hours')[i],rating=shapes.filter(x=>x.kind==='rating')[i];
 assert.ok(work && rating);
 assert.equal(work.x,rating.x);assert.equal(work.width,rating.width);
 assert.equal(Math.min(rating.y,rating.y+rating.height),16);
 assert.ok(Math.max(rating.y,rating.y+rating.height)<work.y);
}
assert.ok(Math.abs(shapes.filter(x=>x.kind==='rating')[1].height)>Math.abs(shapes.filter(x=>x.kind==='rating')[0].height));
console.log('PASS: inverted rating bars share workload columns, descend from the top, and stay in their upper band');

