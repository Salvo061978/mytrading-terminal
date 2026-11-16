import {useState} from 'react';
import TradingChart from './TradingChart';
const symbols=['EURUSD','GBPUSD','XAUUSD','NAS100','GER40'];
const accounts=[{name:'Prop Account 01',balance:5000,equity:5145,pnl:145},{name:'Prop Account 02',balance:10000,equity:9982,pnl:-18}];
export default function App(){
 const [symbol,setSymbol]=useState('EURUSD');
 const [account,setAccount]=useState(0);
 const [side,setSide]=useState<'BUY'|'SELL'>('BUY');
 const [volume,setVolume]=useState('0.10');
 const [sl,setSl]=useState('');
 const [tp,setTp]=useState('');
 const [tab,setTab]=useState('Posizioni');
 const a=accounts[account];
 return <div className="shell">
 <header><div className="logo"><span className="logoMark">◆</span> MYTRADING <span className="muted">TERMINAL</span></div><div className="headRight"><span className="demo">● MODALITÀ DEMO</span><span className="muted">Nessun broker collegato</span></div></header>
 <div className="main">
 <aside><h4>WATCHLIST</h4>{symbols.map((s,i)=><button key={s} className={'watch '+(symbol===s?'selected':'')} onClick={()=>setSymbol(s)}><span>{s}<small>{['Euro / US Dollar','British Pound','Gold Spot','Nasdaq 100','DAX 40'][i]}</small></span><span className="positive">{['1.0842','1.2658','2,601.4','21,142','19,210'][i]}</span></button>)}<div className="asideFoot">Dati simulati · Nessun feed live</div></aside>
 <section className="workspace"><TradingChart symbol={symbol}/>
 <div className="positions"><div className="tabs">{['Posizioni','Storico','Prop Manager','EA Manager'].map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</div>{tab==='Posizioni'?<div className="empty">Nessuna posizione aperta · Collegamento broker non attivo</div>:tab==='Storico'?<div className="empty">Nessuna operazione registrata</div>:tab==='Prop Manager'?<div className="risk"><div>Drawdown giornaliero <b>Non configurato</b></div><div>Regola consistenza <b>Non configurata</b></div><div>Limiti prop firm <b>Da verificare</b></div></div>:<div className="empty">EA Manager · Connettore MT5 previsto in una versione successiva</div>}</div></section>
 <aside className="right"><h4>ACCOUNT</h4><select value={account} onChange={e=>setAccount(Number(e.target.value))}>{accounts.map((x,i)=><option key={x.name} value={i}>{x.name} (DEMO)</option>)}</select><div className="stat"><span>Balance</span><b>${a.balance.toLocaleString('en-US',{minimumFractionDigits:2})}</b></div><div className="stat"><span>Equity</span><b>${a.equity.toLocaleString('en-US',{minimumFractionDigits:2})}</b></div><div className="stat"><span>P&L</span><b className={a.pnl>=0?'positive':'negative'}>{a.pnl>=0?'+':''}${a.pnl}</b></div><div className="separator"/><h4>NUOVO ORDINE</h4><div className="buySell"><button className={side==='BUY'?'buy active':''} onClick={()=>setSide('BUY')}>BUY</button><button className={side==='SELL'?'sell active':''} onClick={()=>setSide('SELL')}>SELL</button></div><label>Volume (lotti)<input type="number" min="0.01" step="0.01" value={volume} onChange={e=>setVolume(e.target.value)}/></label><label>Stop Loss<input placeholder="Prezzo SL" value={sl} onChange={e=>setSl(e.target.value)}/></label><label>Take Profit<input placeholder="Prezzo TP" value={tp} onChange={e=>setTp(e.target.value)}/></label><button className="submit" disabled>CONNESSIONE BROKER RICHIESTA</button><p className="note">Per sicurezza l'invio di ordini reali è disabilitato.</p></aside>
 </div><footer>MyTrading Terminal v0.2 · Prototipo personale · Dati e saldi esclusivamente dimostrativi</footer></div>
}
