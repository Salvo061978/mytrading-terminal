import {useEffect,useRef,useState} from 'react';
import {createChart,ColorType,LineStyle, type IChartApi,type ISeriesApi,type CandlestickData,type UTCTimestamp,type Time} from 'lightweight-charts';

type TF='5m'|'15m'|'1H'|'4H'|'1D';
type Tool='cursor'|'horizontal'|'trend'|'fib';
type Point={time:UTCTimestamp;price:number};
type Drawing={id:number;kind:Exclude<Tool,'cursor'>;a:Point;b?:Point};
const tfSeconds:Record<TF,number>={'5m':300,'15m':900,'1H':3600,'4H':14400,'1D':86400};
function generate(symbol:string,tf:TF):CandlestickData<UTCTimestamp>[]{
 const start=symbol==='XAUUSD'?2600:symbol==='NAS100'?21000:symbol==='GER40'?19000:symbol==='GBPUSD'?1.2658:1.0842;
 const scale=start>100?start*.0008:start*.0007;
 const seed=symbol.split('').reduce((n,c)=>n+c.charCodeAt(0),0);
 let p=start;const step=tfSeconds[tf];const end=Math.floor(Date.now()/1000/step)*step;
 return Array.from({length:240},(_,i)=>{
 const wave=Math.sin((i+seed)*.29)*.8+Math.cos((i+seed)*.083)*1.2+Math.sin((i+seed)*.023)*.7;
 const open=p,close=p+wave*scale*.28;
 const high=Math.max(open,close)+scale*(.12+Math.abs(Math.sin(i*1.8+seed))*.35);
 const low=Math.min(open,close)-scale*(.12+Math.abs(Math.cos(i*1.6+seed))*.35);
 p=close;return {time:(end-(239-i)*step) as UTCTimestamp,open,high,low,close};
 });
}
function storageKey(symbol:string,tf:TF){return 'mytrading:v02:drawings:'+symbol+':'+tf}
function load(symbol:string,tf:TF):Drawing[]{try{const data=JSON.parse(localStorage.getItem(storageKey(symbol,tf))||'[]');return Array.isArray(data)?data:[]}catch{return []}}
export default function TradingChart({symbol}:{symbol:string}){
 const holder=useRef<HTMLDivElement>(null);
 const chartRef=useRef<IChartApi|null>(null);
 const seriesRef=useRef<ISeriesApi<'Candlestick'>|null>(null);
 const overlays=useRef<ISeriesApi<'Line'>[]>([]);
 const [tf,setTf]=useState<TF>('1H');
 const [tool,setTool]=useState<Tool>('cursor');
 const [drawings,setDrawings]=useState<Drawing[]>(()=>load(symbol,'1H'));
 const [pending,setPending]=useState<Point|null>(null);
 const [showGrid,setShowGrid]=useState(true);
 const current=useRef({tool,drawings,pending});
 current.current={tool,drawings,pending};
 useEffect(()=>{setDrawings(load(symbol,tf));setPending(null)},[symbol,tf]);
 useEffect(()=>{
 if(!holder.current)return;
 const el=holder.current;
 const chart=createChart(el,{width:el.clientWidth,height:Math.max(390,el.clientHeight),layout:{background:{type:ColorType.Solid,color:'#101722'},textColor:'#9daec2'},grid:{vertLines:{color:showGrid?'#202b39':'#101722'},horzLines:{color:showGrid?'#202b39':'#101722'}},rightPriceScale:{borderColor:'#2a3645'},timeScale:{borderColor:'#2a3645',timeVisible:true,secondsVisible:false},crosshair:{vertLine:{labelBackgroundColor:'#344b62'},horzLine:{labelBackgroundColor:'#344b62'}}});
 chartRef.current=chart;
 const s=chart.addCandlestickSeries({upColor:'#20b88a',downColor:'#ec6575',borderVisible:false,wickUpColor:'#20b88a',wickDownColor:'#ec6575',priceFormat:symbol==='EURUSD'||symbol==='GBPUSD'?{type:'price',precision:5,minMove:.00001}:{type:'price',precision:2,minMove:.01}});
 seriesRef.current=s;s.setData(generate(symbol,tf));chart.timeScale().fitContent();
 const onClick=(param:{time?:Time;point?:{x:number;y:number}})=>{
 if(!param.point||param.time===undefined)return;
 const price=s.coordinateToPrice(param.point.y);
 if(price===null||typeof param.time!=='number')return;
 const point={time:param.time as UTCTimestamp,price};
 const state=current.current;if(state.tool==='cursor')return;
 if(state.tool==='horizontal'){
 setDrawings(old=>[...old,{id:Date.now(),kind:'horizontal',a:point}]);return;
 }
 if(!state.pending){setPending(point);return}
 setDrawings(old=>[...old,{id:Date.now(),kind:state.tool as 'trend'|'fib',a:state.pending!,b:point}]);
 setPending(null);
 };
 chart.subscribeClick(onClick);
 const ro=new ResizeObserver(()=>chart.applyOptions({width:el.clientWidth,height:Math.max(390,el.clientHeight)}));ro.observe(el);
 return ()=>{ro.disconnect();chart.unsubscribeClick(onClick);chart.remove();chartRef.current=null;seriesRef.current=null;overlays.current=[]};
 },[symbol,tf,showGrid]);
 useEffect(()=>{
 localStorage.setItem(storageKey(symbol,tf),JSON.stringify(drawings));
 const chart=chartRef.current;if(!chart||!seriesRef.current)return;
 overlays.current.forEach(s=>chart.removeSeries(s));overlays.current=[];
 const addLine=(a:Point,b:Point,color:string,style=LineStyle.Solid)=>{
 const s=chart.addLineSeries({color,lineWidth:2,lineStyle:style,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
 const pts=[a,b].sort((x,y)=>x.time-y.time);
 if(pts[0].time===pts[1].time){chart.removeSeries(s);return}
 s.setData(pts.map(p=>({time:p.time,value:p.price})));overlays.current.push(s);
 };
 for(const d of drawings){
 if(d.kind==='horizontal'){const span=tfSeconds[tf];addLine({time:(d.a.time-90*span) as UTCTimestamp,price:d.a.price},{time:(d.a.time+90*span) as UTCTimestamp,price:d.a.price},'#f6c46a',LineStyle.Dashed);continue}
 if(!d.b)continue;
 if(d.kind==='trend')addLine(d.a,d.b,'#5bb8ff');
 if(d.kind==='fib'){
 const lo=Math.min(d.a.time,d.b.time),hi=Math.max(d.a.time,d.b.time);
 for(const ratio of [0,.236,.382,.5,.618,.786,1]){
 const price=d.a.price+(d.b.price-d.a.price)*ratio;
 addLine({time:lo,price},{time:hi,price},ratio===.5?'#f6c46a':'#9d8ef7',LineStyle.Dashed);
 }
 }
 }
 },[drawings,symbol,tf,showGrid]);
 const changeTool=(next:Tool)=>{setTool(next);setPending(null)};
 const undo=()=>setDrawings(d=>d.slice(0,-1));
 const clear=()=>{setDrawings([]);setPending(null);setTf(x=>x)};
 return <div className="advancedChart">
 <div className="chartTop"><div><strong>{symbol}</strong><span className="muted"> · SIMULAZIONE / Nessun feed live</span></div><div className="timeframes">{(['5m','15m','1H','4H','1D'] as TF[]).map(t=><button key={t} className={tf===t?'active':''} onClick={()=>setTf(t)}>{t}</button>)}</div></div>
 <div className="drawingBar">
 {([['cursor','↖ Seleziona'],['horizontal','━ Livello'],['trend','╱ Trendline'],['fib','≋ Fibonacci']] as [Tool,string][]).map(([id,label])=><button key={id} className={tool===id?'active':''} onClick={()=>changeTool(id)}>{label}</button>)}
 <button onClick={undo} disabled={!drawings.length}>↶ Annulla</button><button onClick={clear} disabled={!drawings.length}>✕ Cancella</button>
 <button onClick={()=>setShowGrid(v=>!v)}>{showGrid?'▦ Griglia':'▢ Griglia'}</button>
 </div>
 <div className="chartCanvas" ref={holder}/>
 <div className="chartHint">{pending?'Seleziona il secondo punto sul grafico':tool==='horizontal'?'Tocca il grafico per aggiungere un livello':tool==='trend'||tool==='fib'?'Tocca due punti per disegnare':'Trascina per spostarti, scorri per zoomare'} · {drawings.length} disegni salvati localmente</div>
 </div>
}
