import {useEffect,useRef,useState} from 'react';
import {createChart,ColorType,LineStyle, type IChartApi,type ISeriesApi,type CandlestickData,type UTCTimestamp,type Time} from 'lightweight-charts';

type TF='5m'|'15m'|'1H'|'4H'|'1D';
type Tool='cursor'|'horizontal'|'trend'|'fib';
type Point={time:UTCTimestamp;price:number};
type Drawing={id:number;kind:Exclude<Tool,'cursor'>;a:Point;b?:Point};
const tfSeconds:Record<TF,number>={'5m':300,'15m':900,'1H':3600,'4H':14400,'1D':86400};
const marketSymbols:Record<string,string>={EURUSD:'EUR/USD',GBPUSD:'GBP/USD',XAUUSD:'XAU/USD',NAS100:'NDX',GER40:'DAX'};
const intervals:Record<TF,string>={'5m':'5min','15m':'15min','1H':'1h','4H':'4h','1D':'1day'};
function parseUTC(value:string):UTCTimestamp{
 const normalized=value.includes(' ')?value.replace(' ','T'):value+'T00:00:00';
 return Math.floor(new Date(normalized+'Z').getTime()/1000) as UTCTimestamp;
}
async function marketCandles(symbol:string,tf:TF,key:string,signal:AbortSignal):Promise<CandlestickData<UTCTimestamp>[]>{
 const url=new URL('https://api.twelvedata.com/time_series');
 url.search=new URLSearchParams({symbol:marketSymbols[symbol]||symbol,interval:intervals[tf],outputsize:'500',timezone:'UTC',apikey:key}).toString();
 const response=await fetch(url,{signal});
 if(!response.ok)throw new Error('HTTP '+response.status);
 const payload=await response.json();
 if(payload.status==='error'||!Array.isArray(payload.values))throw new Error(payload.message||'Dati non disponibili per questo simbolo/timeframe');
 const candles=payload.values.map((v:{datetime:string;open:string;high:string;low:string;close:string})=>({
 time:parseUTC(v.datetime),open:Number(v.open),high:Number(v.high),low:Number(v.low),close:Number(v.close)
 })).filter((v:CandlestickData<UTCTimestamp>)=>Number.isFinite(v.close)&&Number.isFinite(v.open)&&Number.isFinite(v.high)&&Number.isFinite(v.low));
 candles.sort((a:CandlestickData<UTCTimestamp>,b:CandlestickData<UTCTimestamp>)=>a.time-b.time);
 if(!candles.length)throw new Error('Nessuna candela valida ricevuta');
 return candles.filter((v:CandlestickData<UTCTimestamp>,i:number,a:CandlestickData<UTCTimestamp>[])=>i===0||v.time!==a[i-1].time);
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
 const loadedKey=useRef(storageKey(symbol,'1H'));
 const [showGrid,setShowGrid]=useState(true);
 const [apiKey,setApiKey]=useState(()=>sessionStorage.getItem('mytrading:tdkey')||'');
 const [draftKey,setDraftKey]=useState(()=>sessionStorage.getItem('mytrading:tdkey')||'');
 const [market,setMarket]=useState<CandlestickData<UTCTimestamp>[]>([]);
 const [status,setStatus]=useState('Inserisci una chiave Twelve Data per caricare prezzi reali');
 const [updated,setUpdated]=useState('');
 const [refresh,setRefresh]=useState(0);
 const current=useRef({tool,drawings,pending});
 current.current={tool,drawings,pending};
 useEffect(()=>{loadedKey.current='';setDrawings(load(symbol,tf));setPending(null)},[symbol,tf]);
 useEffect(()=>{
 if(!apiKey){setMarket([]);setStatus('Nessun feed collegato');return}
 const controller=new AbortController();setStatus('Caricamento dati Twelve Data…');
 marketCandles(symbol,tf,apiKey,controller.signal).then(data=>{if(controller.signal.aborted)return;setMarket(data);setUpdated(new Date().toLocaleString('it-IT'));setStatus('Dati Twelve Data · '+data.length+' candele');}).catch(e=>{if(controller.signal.aborted)return;setMarket([]);setStatus('Errore feed: '+(e instanceof Error?e.message:String(e)));});
 return ()=>controller.abort();
 },[symbol,tf,apiKey,refresh]);
 useEffect(()=>{
 if(!holder.current)return;
 const el=holder.current;
 const chart=createChart(el,{width:el.clientWidth,height:Math.max(390,el.clientHeight),layout:{background:{type:ColorType.Solid,color:'#101722'},textColor:'#9daec2'},grid:{vertLines:{color:showGrid?'#202b39':'#101722'},horzLines:{color:showGrid?'#202b39':'#101722'}},rightPriceScale:{borderColor:'#2a3645'},timeScale:{borderColor:'#2a3645',timeVisible:true,secondsVisible:false},crosshair:{vertLine:{labelBackgroundColor:'#344b62'},horzLine:{labelBackgroundColor:'#344b62'}}});
 chartRef.current=chart;
 const s=chart.addCandlestickSeries({upColor:'#20b88a',downColor:'#ec6575',borderVisible:false,wickUpColor:'#20b88a',wickDownColor:'#ec6575',priceFormat:symbol==='EURUSD'||symbol==='GBPUSD'?{type:'price',precision:5,minMove:.00001}:{type:'price',precision:2,minMove:.01}});
 seriesRef.current=s;s.setData([]);
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
 useEffect(()=>{const s=seriesRef.current;const c=chartRef.current;if(!s||!c)return;s.setData(market);if(market.length)c.timeScale().fitContent()},[market,symbol,tf,showGrid]);
 useEffect(()=>{
 if(loadedKey.current!==storageKey(symbol,tf)){loadedKey.current=storageKey(symbol,tf);return}
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
 const lo=Math.min(d.a.time,d.b.time) as UTCTimestamp,hi=Math.max(d.a.time,d.b.time) as UTCTimestamp;
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
 <div className="chartTop"><div><strong>{symbol}</strong><span className="muted"> · {status}{updated?' · ultimo caricamento '+updated:''}</span></div><div className="timeframes">{(['5m','15m','1H','4H','1D'] as TF[]).map(t=><button key={t} className={tf===t?'active':''} onClick={()=>setTf(t)}>{t}</button>)}</div></div>
 <div className="feedBar"><input aria-label="Chiave API Twelve Data" type="password" placeholder="Chiave API Twelve Data (personale)" value={draftKey} onChange={e=>setDraftKey(e.target.value)}/><button onClick={()=>{const key=draftKey.trim();if(key)sessionStorage.setItem('mytrading:tdkey',key);else sessionStorage.removeItem('mytrading:tdkey');setApiKey(key);setRefresh(n=>n+1)}}>Collega feed</button><button onClick={()=>setRefresh(n=>n+1)} disabled={!apiKey}>↻ Aggiorna</button><small>Chiave solo in questa sessione del browser · non inserirla in GitHub</small></div>
 <div className="drawingBar">
 {([['cursor','↖ Seleziona'],['horizontal','━ Livello'],['trend','╱ Trendline'],['fib','≋ Fibonacci']] as [Tool,string][]).map(([id,label])=><button key={id} className={tool===id?'active':''} onClick={()=>changeTool(id)}>{label}</button>)}
 <button onClick={undo} disabled={!drawings.length}>↶ Annulla</button><button onClick={clear} disabled={!drawings.length}>✕ Cancella</button>
 <button onClick={()=>setShowGrid(v=>!v)}>{showGrid?'▦ Griglia':'▢ Griglia'}</button>
 </div>
 <div className="chartCanvas" ref={holder}/>
 <div className="chartHint">{pending?'Seleziona il secondo punto sul grafico':tool==='horizontal'?'Tocca il grafico per aggiungere un livello':tool==='trend'||tool==='fib'?'Tocca due punti per disegnare':'Trascina per spostarti, scorri per zoomare'} · {drawings.length} disegni salvati localmente</div>
 </div>
}
