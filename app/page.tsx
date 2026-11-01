'use client';

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

type Day = { burn: string; eat: string };
type Week = { start: string; days: Day[]; savedAt: string };
type Tab = 'entry' | 'history' | 'analysis';
const STORAGE_KEY = 'calorie-tracker-weeks-v1';
const emptyDays = (): Day[] => Array.from({ length: 7 }, () => ({ burn: '', eat: '' }));
const localISO = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const dateAtNoon = (iso: string) => new Date(`${iso}T12:00:00`);
const plusDays = (iso: string, amount: number) => { const d = dateAtNoon(iso); d.setDate(d.getDate()+amount); return d; };
const fmtDate = (d: Date) => `${d.getMonth()+1}/${d.getDate()}`;
const fmtDay = (d: Date) => ['日','月','火','水','木','金','土'][d.getDay()];
const valid = (v: string) => v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 && Number.isSafeInteger(Number(v));
const value = (v: string) => valid(v) ? Number(v) : 0;
const balance = (d: Day) => valid(d.burn) && valid(d.eat) ? value(d.eat)-value(d.burn) : null;
const total = (days: Day[], key: 'burn'|'eat') => days.reduce((s,d)=>s+value(d[key]),0);
const complete = (days: Day[]) => days.filter(d=>balance(d)!==null).length;
const weekBalance = (days: Day[]) => days.reduce((s,d)=>s+(balance(d)??0),0);
const signed = (n: number) => `${n>0?'+':''}${n.toLocaleString('ja-JP')}`;
const yen = (n: number) => `${n.toLocaleString('ja-JP')} kcal`;

function textExport(w: Week) {
  const rows = ['【カロリー収支記録】',`期間：${w.start} 〜 ${localISO(plusDays(w.start,6))}`,'','日付\t消費\t摂取\t収支'];
  w.days.forEach((d,i)=>rows.push(`${localISO(plusDays(w.start,i))}\t${d.burn}\t${d.eat}\t${balance(d)??''}`));
  rows.push('',`週間消費：${total(w.days,'burn')} kcal`,`週間摂取：${total(w.days,'eat')} kcal`,`週間収支：${signed(weekBalance(w.days))} kcal`);
  return rows.join('\n');
}
function sheetRows(w: Week) {
  const rows: (string|number)[][] = [['日付','曜日','消費カロリー(kcal)','摂取カロリー(kcal)','収支(kcal)']];
  w.days.forEach((d,i)=>{const date=plusDays(w.start,i);rows.push([localISO(date),fmtDay(date),valid(d.burn)?value(d.burn):'',valid(d.eat)?value(d.eat):'',balance(d)??'']);});
  rows.push(['週間合計','',total(w.days,'burn'),total(w.days,'eat'),weekBalance(w.days)]);
  return rows;
}

export default function Home() {
  const [tab,setTab] = useState<Tab>('entry');
  const [start,setStart] = useState(localISO(new Date()));
  const [days,setDays] = useState<Day[]>(emptyDays());
  const [weeks,setWeeks] = useState<Record<string,Week>>({});
  const [selected,setSelected] = useState<string|null>(null);
  const [notice,setNotice] = useState('記録はこのブラウザ内に保存されるよ。');
  const [ready,setReady] = useState(false);

  useEffect(()=>{
    try { const raw=localStorage.getItem(STORAGE_KEY); if(raw) setWeeks(JSON.parse(raw)); }
    catch { setNotice('保存データを読み込めなかったよ。'); }
    setReady(true);
  },[]);
  useEffect(()=>{
    if(!ready)return;
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(weeks)); }
    catch { setNotice('ブラウザの保存容量が不足している可能性があるよ。'); }
  },[weeks,ready]);

  const eat=total(days,'eat'), burn=total(days,'burn'), net=weekBalance(days), count=complete(days);
  const sortedKeys=useMemo(()=>Object.keys(weeks).sort((a,b)=>b.localeCompare(a)),[weeks]);
  const allDays=Object.values(weeks).flatMap(w=>w.days).filter(d=>balance(d)!==null);
  const allEat=total(allDays,'eat'), allBurn=total(allDays,'burn'), allNet=allEat-allBurn;

  const updateDay=(index:number,key:keyof Day,raw:string)=>{
    if(raw!==''&&(!/^\d+$/.test(raw)||!Number.isSafeInteger(Number(raw))))return;
    setDays(prev=>prev.map((d,i)=>i===index?{...d,[key]:raw}:d));
  };
  const saveWeek=()=>{
    if(!start){setNotice('開始日を指定してね。');return;}
    if(count!==7){setNotice('保存するには7日分すべての摂取・消費を入力してね。');return;}
    if(weeks[start]&&!window.confirm('同じ開始日の記録があるよ。上書きする？'))return;
    setWeeks(prev=>({...prev,[start]:{start,days:days.map(d=>({...d})),savedAt:new Date().toISOString()}}));
    setSelected(start);setNotice('週間記録を保存したよ！');
  };
  const loadWeek=(key:string)=>{
    const w=weeks[key];if(!w)return;
    setStart(w.start);setDays(w.days.map(d=>({...d})));setSelected(key);setTab('entry');setNotice('保存した週を読み込んだよ。編集後は再保存してね。');
  };
  const newWeek=()=>{
    const latest=Object.keys(weeks).sort().pop();
    const next=latest?localISO(plusDays(latest,7)):localISO(new Date());
    setStart(next);setDays(emptyDays());setSelected(null);setTab('entry');setNotice('新しい週を開始したよ。');
  };
  const copy=async(content:string,label:string)=>{
    try { await navigator.clipboard.writeText(content);setNotice(label); }
    catch { setNotice('コピーに失敗したよ。HTTPS接続かブラウザの権限を確認してね。'); }
  };
  const download=(name:string,content:string,type:string)=>{
    const blob=new Blob(['\ufeff',content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);setNotice('ファイルを書き出したよ。');
  };
  const exportXlsx=(entries:Week[],name:string)=>{
    const wb=XLSX.utils.book_new();
    entries.forEach((w,i)=>{
      const ws=XLSX.utils.aoa_to_sheet(sheetRows(w));
      ws['!cols']=[{wch:14},{wch:9},{wch:20},{wch:20},{wch:15}];
      XLSX.utils.book_append_sheet(wb,ws,`${w.start.slice(5).replace('-','')}_${i+1}`.slice(0,31));
    });
    XLSX.writeFile(wb,name);setNotice('Excelファイルを書き出したよ。');
  };
  const exportAllTsv=()=>{
    const rows: (string|number)[][] = [['週開始日','日付','曜日','消費(kcal)','摂取(kcal)','収支(kcal)']];
    Object.keys(weeks).sort().forEach(k=>{const w=weeks[k];w.days.forEach((d,i)=>{const date=plusDays(k,i);rows.push([k,localISO(date),fmtDay(date),valid(d.burn)?value(d.burn):'',valid(d.eat)?value(d.eat):'',balance(d)??'']);});rows.push([k,'週間合計','',total(w.days,'burn'),total(w.days,'eat'),weekBalance(w.days)]);});
    return rows.map(r=>r.join('\t')).join('\n');
  };
  const deleteWeek=(key:string)=>{
    if(!window.confirm(`${key}開始の記録を削除する？`))return;
    setWeeks(prev=>{const next={...prev};delete next[key];return next;});
    if(selected===key)setSelected(null);setNotice('記録を削除したよ。');
  };
  const changeStart=(value:string)=>{
    setStart(value);
    if(weeks[value]&&window.confirm('この日付で保存済みの週があるよ。読み込む？'))loadWeek(value);
    else setSelected(null);
  };

  return <main className="app-shell">
    <header className="header">
      <div className="brand"><div className="brand-mark">↗</div><div><div className="eyebrow">HEALTH LOG / WEEKLY</div><h1>HealSee</h1></div></div>
      <span className="local-badge">● ブラウザ保存</span>
    </header>
    <nav className="tabs" aria-label="メインメニュー">
      {([['entry','入力・週間収支'],['history','保存済み記録'],['analysis','累計分析']] as [Tab,string][]).map(([id,label])=><button key={id} className={`tab ${tab===id?'active':''}`} onClick={()=>setTab(id)}>{label}</button>)}
    </nav>

    {tab==='entry'&&<section>
      <div className="grid">
        <div className="card date-card"><div><label htmlFor="start-date">1日目の日付（開始日）</label><input id="start-date" className="date-input" type="date" value={start} onChange={e=>changeStart(e.target.value)}/><div className="hint" style={{marginTop:7}}>指定日から7日間を自動生成</div></div><div style={{fontSize:35}}>🗓️</div></div>
        <div className="card"><h2>週間カロリー収支</h2><div className="stats">
          <div><div className="stat-label">週間摂取</div><div className="stat-value">{eat.toLocaleString()}<span className="stat-unit"> kcal</span></div></div>
          <div><div className="stat-label">週間消費</div><div className="stat-value">{burn.toLocaleString()}<span className="stat-unit"> kcal</span></div></div>
          <div><div className="stat-label">週間収支</div><div className={`stat-value ${net<0?'balance-negative':net>0?'balance-positive':''}`}>{signed(net)}<span className="stat-unit"> kcal</span></div></div>
        </div><div className="progress-track"><div className="progress-fill" style={{width:`${count/7*100}%`}}/></div><div className="hint" style={{marginTop:7}}>{count}/7日分入力済み</div></div>
      </div>
      <div className="section-head"><h2>毎日のカロリー入力</h2><span className="hint">摂取 − 消費 ＝ 収支</span></div>
      <div className="card"><div className="day-list">{days.map((d,i)=>{const date=plusDays(start,i),b=balance(d);return <div className="day-row" key={i}>
        <div className="day-date">{i+1}日目 <small>{fmtDate(date)}（{fmtDay(date)}）</small></div>
        <div className="field"><label htmlFor={`burn-${i}`}>消費カロリー（kcal）</label><input id={`burn-${i}`} className="number-input" type="number" min="0" step="1" inputMode="numeric" placeholder="例：2300" value={d.burn} onChange={e=>updateDay(i,'burn',e.target.value)}/></div>
        <div className="field"><label htmlFor={`eat-${i}`}>摂取カロリー（kcal）</label><input id={`eat-${i}`} className="number-input" type="number" min="0" step="1" inputMode="numeric" placeholder="例：2100" value={d.eat} onChange={e=>updateDay(i,'eat',e.target.value)}/></div>
        <div className={`day-balance ${b!==null&&b<0?'balance-negative':b!==null&&b>0?'balance-positive':'muted'}`}>{b===null?'未入力':`${signed(b)} kcal`}</div>
      </div>})}</div>
      <div className="actions"><button className="btn primary full" onClick={saveWeek}>週間記録を保存</button><button className="btn" onClick={()=>{if(confirm('入力中の数値をすべて消去する？')){setDays(emptyDays());setSelected(null);setNotice('入力をクリアしたよ。');}}}>数値をクリア</button></div></div>
      <div className="section-head"><h2>コピー・エクスポート</h2><span className="hint">入力中の週を出力</span></div>
      <div className="card"><div className="actions" style={{marginTop:0}}>
        <button className="btn" onClick={()=>copy(textExport({start,days,savedAt:''}),'テキストをコピーしたよ。')}>テキストコピー</button>
        <button className="btn" onClick={()=>copy(sheetRows({start,days,savedAt:''}).map(r=>r.join('\t')).join('\n'),'表形式をコピーしたよ。Excelなどに貼り付けてね。')}>表形式コピー</button>
        <button className="btn" onClick={()=>download(`calorie-${start}.csv`,sheetRows({start,days,savedAt:''}).map(r=>r.join(',')).join('\n'),'text/csv;charset=utf-8')}>CSVダウンロード</button>
        <button className="btn" onClick={()=>exportXlsx([{start,days,savedAt:''}],`calorie-${start}.xlsx`)}>Excel（.xlsx）</button>
      </div><p className="hint" style={{lineHeight:1.7,marginBottom:0}}>Excel・Googleスプレッドシート向けの表形式コピーは、タブ区切りで列ごとに貼り付けられるよ。Excelファイルは.xlsx形式で出力できるよ。</p></div>
    </section>}

    {tab==='history'&&<section><div className="section-head" style={{marginTop:0}}><h2>保存済みの週間記録</h2><span className="hint">{sortedKeys.length}週保存</span></div>
      <div className="record-list">{sortedKeys.length===0?<div className="empty">保存された週はまだないよ。<br/>入力画面から最初の週を保存してね。</div>:sortedKeys.map(key=>{const w=weeks[key],b=weekBalance(w.days);return <article className="record" key={key}>
        <div className="record-top"><div><div className="record-title">{key} 〜 {localISO(plusDays(key,6))}</div><div className="record-meta">{complete(w.days)}/7日入力 ・ 摂取 {yen(total(w.days,'eat'))} ・ 消費 {yen(total(w.days,'burn'))}</div></div><strong className={b<0?'balance-negative':b>0?'balance-positive':''}>{signed(b)} kcal</strong></div>
        <div className="record-actions"><button className="btn primary" onClick={()=>loadWeek(key)}>開く・編集</button><button className="btn" onClick={()=>copy(textExport(w),'保存済みの週をコピーしたよ。')}>テキストコピー</button><button className="btn" onClick={()=>exportXlsx([w],`calorie-${key}.xlsx`)}>Excel出力</button><button className="btn danger" onClick={()=>deleteWeek(key)}>削除</button></div>
      </article>})}</div>
      <div className="actions"><button className="btn primary" onClick={newWeek}>次の週を作成</button><button className="btn" onClick={()=>{setTab('entry');setStart(localISO(new Date()));setDays(emptyDays());setSelected(null);}}>今日から新規入力</button></div>
      {sortedKeys.length>0&&<div className="card" style={{marginTop:16}}><h3>全週間データの一括出力</h3><div className="actions" style={{marginTop:0}}><button className="btn" onClick={()=>copy(sortedKeys.slice().sort().map(k=>textExport(weeks[k])).join('\n\n--------------------\n\n'),'全週のテキストをコピーしたよ。')}>全週テキストコピー</button><button className="btn" onClick={()=>copy(exportAllTsv(),'全週の表形式データをコピーしたよ。')}>全週表形式コピー</button><button className="btn" onClick={()=>download('calorie-all-weeks.csv',exportAllTsv(),'text/csv;charset=utf-8')}>全週CSV</button><button className="btn" onClick={()=>exportXlsx(Object.keys(weeks).sort().map(k=>weeks[k]),'calorie-all-weeks.xlsx')}>全週Excel</button></div></div>}
    </section>}

    {tab==='analysis'&&<section><div className="section-head" style={{marginTop:0}}><h2>全期間の累計分析</h2><span className="hint">保存済みデータが対象</span></div>
      <div className="card"><div className="stats">
        <div><div className="stat-label">保存週数</div><div className="stat-value">{sortedKeys.length}</div></div>
        <div><div className="stat-label">入力済み日数</div><div className="stat-value">{allDays.length}</div></div>
        <div><div className="stat-label">累計収支</div><div className={`stat-value ${allNet<0?'balance-negative':allNet>0?'balance-positive':''}`}>{signed(allNet)}<span className="stat-unit"> kcal</span></div></div>
      </div><div className="grid" style={{marginTop:18}}><div><div className="stat-label">総摂取カロリー</div><div className="stat-value">{eat.toLocaleString()}</div><div className="hint">現在編集中の週</div></div><div><div className="stat-label">全期間の総摂取</div><div className="stat-value">{allEat.toLocaleString()}</div><div className="hint">保存済み週のみ</div></div><div><div className="stat-label">全期間の総消費</div><div className="stat-value">{allBurn.toLocaleString()}</div><div className="hint">保存済み週のみ</div></div></div></div>
      <div className="card" style={{marginTop:15}}><h3>週ごとの収支</h3>{sortedKeys.length===0?<div className="empty">週間記録を保存すると、ここに推移が表示されるよ。</div>:<div className="weekly-bars">{sortedKeys.slice().reverse().map(k=>{const n=weekBalance(weeks[k].days),max=Math.max(1,...sortedKeys.map(x=>Math.abs(weekBalance(weeks[x].days))));return <div className="bar-row" key={k}><span>{k.slice(5)}</span><div className="bar-track"><div className={`bar-fill ${n<0?'deficit':n>0?'surplus':''}`} style={{width:`${Math.max(2,Math.abs(n)/max*100)}%`}}/></div><strong className={n<0?'balance-negative':n>0?'balance-positive':''}>{signed(n)}</strong></div>})}</div>}</div>
      <div className="actions"><button className="btn" onClick={()=>copy(sortedKeys.slice().sort().map(k=>textExport(weeks[k])).join('\n\n'),'全記録をコピーしたよ。')}>全記録テキストコピー</button><button className="btn" onClick={()=>copy(exportAllTsv(),'全記録の表形式をコピーしたよ。')}>全記録表形式コピー</button><button className="btn" onClick={()=>exportXlsx(Object.keys(weeks).sort().map(k=>weeks[k]),'calorie-all-weeks.xlsx')} disabled={!sortedKeys.length}>全記録Excel出力</button></div>
    </section>}
    <div className="notice" role="status">{notice}</div>
    <p className="footer-note">※収支は「摂取カロリー − 消費カロリー」で計算。マイナスは摂取が消費を下回る状態、プラスは上回る状態を示すよ。<br/>※データはこのブラウザのローカルストレージに保存されるため、別端末・別ブラウザとは自動同期されないよ。ブラウザデータの削除で記録が消える場合があるので、定期的にCSVまたはExcelでバックアップしてね。</p>
  </main>;
}
