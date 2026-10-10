// @ts-nocheck
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { GiRobberMask, GiSwapBag, GiPunch, GiSprint, GiLockPicking, GiSecretDoor, GiSiren, GiJewelCrown, GiExitDoor, GiPodiumWinner, GiStopwatch, GiSpeaker, GiSpeakerOff, GiSettingsKnobs, GiHandcuffs, GiTwoCoins, GiTrophyCup, GiRunningNinja, GiDeliveryDrone, GiHidden, GiPerspectiveDiceSixFacesRandom, GiPlayButton, GiCrown, GiCheckMark, GiCancel, GiLaurelsTrophy, GiPauseButton, GiLinkedRings, GiRobotGrab, GiMoneyStack } from 'react-icons/gi';
import { HeistEngine } from './engine';
import { Sound } from './audio';
import { WORLD, WALLS, CASES, CABINETS, EXITS, ITEMS, RULES, roomAt } from '@hapai/shared';

const SERVER = process.env.NEXT_PUBLIC_SERVER_URL || (typeof location !== 'undefined' ? `${location.protocol}//${location.hostname}:10000` : 'http://localhost:10000');
const NAMES = ['Тихий Лис', 'Ночной Кот', 'Шустрик', 'Барон', 'Тень', 'Фантом', 'Пиксель', 'Ловкач', 'Енот', 'Мистер Икс', 'Сова', 'Призрак'];
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const isTouch = () => typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches;

export default function Game() {
  const stage = useRef(null), overlay = useRef(null), engine = useRef(null), socket = useRef(null), sound = useRef(null), mini = useRef(null);
  const [screen, setScreen] = useState('menu');
  const [progress, setProgress] = useState(0), [ready, setReady] = useState(false), [error, setError] = useState('');
  const [name, setName] = useState(''), [code, setCode] = useState(''), [busy, setBusy] = useState(false);
  const [state, setState] = useState(null), [myId, setMyId] = useState(null), [hint, setHint] = useState(null);
  const [toast, setToast] = useState(''), [modal, setModal] = useState(null), [copied, setCopied] = useState(false);
  const [quality, setQuality] = useState('high'), [vol, setVol] = useState(.8), [mus, setMus] = useState(.45), [ping, setPing] = useState(0), [touch, setTouch] = useState(false);
  const input = useRef({ keys: new Set(), mouse: null, angle: Math.PI / 2, interact: false, touchMove: { x: 0, z: 0 }, touchLook: null, touchInteract: false, lastSent: 0 });
  const stRef = useRef(null), lastCount = useRef(-1), stealTick = useRef(0);

  // ---------- инициализация
  useEffect(() => {
    setTouch(isTouch());
    setName(localStorage.getItem('hapai-name') || NAMES[Math.floor(Math.random() * NAMES.length)]);
    const q = localStorage.getItem('hapai-quality') || (isTouch() ? 'medium' : 'high'); setQuality(q);
    const room = new URLSearchParams(location.search).get('room'); if (room) setCode(room.toUpperCase());
    sound.current = new Sound(); setVol(sound.current.volume); setMus(sound.current.musicVolume);
    const e = new HeistEngine(stage.current, overlay.current, {
      quality: q, audio: sound.current, onProgress: setProgress, onReady: () => setReady(true), onError: setError,
      onHint: setHint, onToast: t => { setToast(t); setTimeout(() => setToast(''), 2200); },
      onDrones: d => sound.current?.hum(d < 12 ? (1 - d / 12) : 0),
    });
    engine.current = e;
    (window as any).__hapai = { getState: () => stRef.current, socket: () => socket.current, input: input.current, engine: e, // хуки для автотестов и записи трейлера
      feed: st => { stRef.current = st; setState(st); e.setState(st, st.you.id); }, enter: id => { setMyId(id); setScreen('room'); }, toast: t => toastMsg(t) };
    return () => { e.destroy(); socket.current?.disconnect(); sound.current?.stopAll(); };
  }, []);

  const toastMsg = t => { setToast(t); setTimeout(() => setToast(''), 2600); };
  const sfx = fn => { sound.current?.unlock(); sound.current?.[fn]?.(); };

  // ---------- сеть
  const connect = useCallback((payload) => new Promise((resolve) => {
    sound.current?.unlock();
    if (socket.current) socket.current.disconnect();
    const s = io(SERVER, { transports: ['websocket', 'polling'], reconnectionAttempts: 8, timeout: 12000 }); socket.current = s;
    let joined = false;
    const join = () => {
      const token = sessionStorage.getItem('hapai-token') || '';
      s.emit('room:join', { ...payload, token: joined ? token : (payload.resume ? token : '') }, res => {
        if (!res?.ok) { setError(res?.error || 'Не удалось подключиться'); setBusy(false); s.disconnect(); resolve(false); return; }
        joined = true; sessionStorage.setItem('hapai-token', res.token); setMyId(res.id); setScreen('room');
        history.replaceState(null, '', `?room=${res.code}`); resolve(true);
      });
    };
    s.on('connect', join);
    s.on('connect_error', () => { if (!joined) { setError('Сервер не отвечает. Если это бесплатный Render — подожди минуту, он просыпается.'); setBusy(false); } });
    s.on('state', st => { stRef.current = st; setState(st); engine.current?.setState(st, st.you.id); });
    s.on('notice', toastMsg);
    s.on('disconnect', r => { if (r !== 'io client disconnect') toastMsg('Связь потеряна. Переподключаемся…'); });
    const pi = setInterval(() => { const t = performance.now(); s.emit('ping:measure', () => setPing(Math.round(performance.now() - t))); }, 3000);
    s.on('disconnect', () => clearInterval(pi));
  }), []);

  const play = async (opts) => {
    if (busy) return; setError(''); setBusy(true); const n = name.trim() || 'Грабитель'; localStorage.setItem('hapai-name', n); sfx('click');
    await connect({ name: n, ...opts }); setBusy(false);
  };
  const leave = () => { socket.current?.emit('leave'); socket.current?.disconnect(); socket.current = null; stRef.current = null; setState(null); setScreen('menu'); setModal(null); history.replaceState(null, '', location.pathname); sound.current?.stopAll(); engine.current?.setMode('menu'); };

  // режим движка по фазе
  const phase = state?.phase;
  useEffect(() => {
    const e = engine.current; if (!e) return;
    if (screen === 'menu') e.setMode('menu');
    else if (phase === 'lobby') { e.setMode('lobby'); e.setLobby(state.roster); }
    else if (phase) e.setMode('game');
  }, [screen, phase, ready]);
  useEffect(() => { if (phase === 'lobby') engine.current?.setLobby(state.roster); }, [state?.roster?.map(r => r.id + r.ready + r.color).join()]);
  useEffect(() => { if (phase === 'playing' || phase === 'countdown') sound.current?.startMusic(); else { sound.current?.stopMusic(); sound.current?.siren(0); } }, [phase]);

  // звуки по состоянию: отсчёт, сирена, взлом
  useEffect(() => {
    if (!state) return; const S = sound.current;
    if (state.phase === 'countdown') { const c = Math.ceil(state.countdown); if (c !== lastCount.current && c <= 3 && c > 0) S?.beep(false); lastCount.current = c; } else lastCount.current = -1;
    if (state.phase === 'playing') {
      const me = state.you; let lvl = 0; for (const a of state.alarms) lvl = Math.max(lvl, Math.max(.22, 1 - Math.hypot(a.x - me.x, a.z - me.z) / 26)); S?.siren(lvl);
      if (me.action?.type === 'steal' && performance.now() - stealTick.current > 140) { stealTick.current = performance.now(); const i = CASES.findIndex(c => c.id === me.action.caseId); S?.stealTick(state.cases[i]?.[1] || 0); }
    }
  }, [state]);

  // ---------- ввод
  useEffect(() => {
    const I = input.current;
    const down = e => {
      if (e.target?.tagName === 'INPUT') return; const k = e.code; I.keys.add(k);
      const st = stRef.current; if (!st || st.phase !== 'playing') { if (k === 'Escape' && st) setModal(m => m ? null : 'pause'); return; }
      if (k === 'Space' || k === 'ShiftLeft' || k === 'ShiftRight') { e.preventDefault(); if (!e.repeat) socket.current?.emit('action', 'dash'); }
      if (k === 'KeyF' || k === 'KeyQ') { if (!e.repeat) socket.current?.emit('action', 'push'); }
      if (k === 'Escape') setModal(m => m ? null : 'pause');
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    };
    const up = e => I.keys.delete(e.code);
    const blur = () => { I.keys.clear(); I.touchInteract = false; I.touchMove = { x: 0, z: 0 }; };
    const mm = e => { if (e.pointerType === 'mouse') I.mouse = { x: e.clientX, y: e.clientY }; };
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', blur); addEventListener('pointermove', mm);
    let raf;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const st = stRef.current, e = engine.current; if (!st || !e || st.phase === 'lobby') return;
      const k = I.keys; let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0), z = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
      if (Math.hypot(I.touchMove.x, I.touchMove.z) > .15) { x = I.touchMove.x; z = I.touchMove.z; }
      const len = Math.hypot(x, z); if (len > 1) { x /= len; z /= len; }
      if (I.touchLook !== null) I.angle = I.touchLook;
      else if (I.mouse && !isTouch()) I.angle = e.pointerAngle(I.mouse.x, I.mouse.y);
      else if (len > .15) I.angle = Math.atan2(z, x);
      const interact = k.has('KeyE') || I.touchInteract || !!I.mouseInteract;
      const inp = { x, z, angle: I.angle, interact }; e.setInput(inp);
      const now = performance.now(); if (now - I.lastSent > 50 || interact !== I.lastInteract) { I.lastSent = now; I.lastInteract = interact; socket.current?.emit('input', inp); }
    };
    tick();
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur); removeEventListener('pointermove', mm); cancelAnimationFrame(raf); };
  }, []);
  const stagePointerDown = e => { if (e.pointerType !== 'mouse') return; sound.current?.unlock(); if (stRef.current?.phase === 'playing') { if (e.button === 0) socket.current?.emit('action', 'push'); if (e.button === 2) input.current.mouseInteract = true; } };
  const stagePointerUp = e => { if (e.button === 2) input.current.mouseInteract = false; };

  // ---------- мини-карта
  useEffect(() => {
    const c = mini.current; if (!c || !state || state.phase === 'lobby') return; const g = c.getContext('2d'), W = c.width, H = c.height, s = W / WORLD.width, t = performance.now() / 1000;
    g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(8,12,24,.86)'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#8ea0c8'; for (const [x, z, w, d] of WALLS) g.fillRect((x - w / 2) * s, (z - d / 2) * s, Math.max(1.5, w * s), Math.max(1.5, d * s));
    CASES.forEach((cs, i) => { const st = state.cases[i]; g.fillStyle = st?.[0] ? '#3a4058' : cs.item === 'crown' ? '#ffd23f' : '#e9c46a'; g.beginPath(); g.arc(cs.x * s, cs.z * s, cs.item === 'crown' ? 3.6 : 2.2, 0, 7); g.fill(); });
    g.fillStyle = '#9b6b43'; for (const h of CABINETS) g.fillRect(h.x * s - 2.5, h.z * s - 2.5, 5, 5);
    EXITS.forEach((ex, i) => { const a = i === state.activeExit; g.strokeStyle = a ? (state.finale ? '#ffcf3d' : '#3dffb0') : 'rgba(255,59,79,.5)'; g.lineWidth = a ? 2.5 : 1.5; g.beginPath(); g.arc(ex.x * s, ex.z * s, a ? 5 + Math.sin(t * 5) * 1.5 : 3.5, 0, 7); g.stroke(); });
    for (const a of state.alarms) { g.strokeStyle = `rgba(255,40,60,${.5 + Math.sin(t * 10) * .4})`; g.lineWidth = 2; g.beginPath(); g.arc(a.x * s, a.z * s, 7 + (t * 12 % 8), 0, 7); g.stroke(); }
    for (const d of state.drones) { g.fillStyle = d.state === 'chase' ? '#ff3b4f' : '#7fd0ff'; g.save(); g.translate(d.x * s, d.z * s); g.rotate(d.angle); g.beginPath(); g.moveTo(5, 0); g.lineTo(-3, 3.5); g.lineTo(-3, -3.5); g.fill(); g.restore(); }
    for (const p of state.players) { g.fillStyle = p.color; g.beginPath(); g.arc(p.x * s, p.z * s, 3, 0, 7); g.fill(); }
    const me = state.you; g.save(); g.translate(me.x * s, me.z * s); g.rotate(input.current.angle); g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, RULES.range * s, -RULES.fov / 2, RULES.fov / 2); g.fill();
    g.fillStyle = me.color; g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(6, 0); g.lineTo(-4, 4); g.lineTo(-2, 0); g.lineTo(-4, -4); g.closePath(); g.fill(); g.stroke(); g.restore();
  }, [state]);

  const S = state, me = S?.you;
  const sorted = S ? [...S.roster].sort((a, b) => b.score - a.score) : [];
  const owner = S && S.owner === myId;
  const link = S && typeof location !== 'undefined' ? `${location.origin}${location.pathname}?room=${S.code}` : '';
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { toastMsg(link); } sfx('click'); };
  const setQ = q => { setQuality(q); localStorage.setItem('hapai-quality', q); engine.current?.setQuality(q); };

  return (
    <main className={`app ${touch ? 'touch' : 'desktop'} phase-${screen === 'menu' ? 'menu' : phase || 'connecting'}`} onContextMenu={e => e.preventDefault()}>
      <div className="stage" ref={stage} onPointerDown={stagePointerDown} onPointerUp={stagePointerUp} />
      <div className="vignette" />
      {S?.alarms?.length > 0 && phase === 'playing' && <div className="alarm-edge" />}
      {S?.finale && <div className="finale-edge" />}
      <div className="overlay" ref={overlay} />

      {!ready && <div className="loader"><div className="logo small"><GiRobberMask /> ХАПАЙ!</div><div className="bar"><i style={{ width: `${progress * 100}%` }} /></div><p>Загружаем музей… {Math.round(progress * 100)}%</p>{error && <p className="err">{error}</p>}</div>}

      {/* ---------- МЕНЮ */}
      {screen === 'menu' && ready && <section className="menu">
        <div className="menu-left">
          <div className="logo"><span>ХАПАЙ!</span><small>ночное ограбление · 2.0</small></div>
          <p className="tagline">Взламывай витрины, прячься в шкафах от дронов и успей вынести добычу раньше друзей.</p>
          <div className="card glass">
            <label className="field-label">Твой ник</label>
            <div className="name-row"><input value={name} maxLength={16} onChange={e => setName(e.target.value)} placeholder="Ник" /><button className="icon-btn" title="Случайный ник" onClick={() => { setName(NAMES[Math.floor(Math.random() * NAMES.length)]); sfx('click'); }}><GiPerspectiveDiceSixFacesRandom /></button></div>
            <button className="btn primary big" disabled={busy} onClick={() => play({})}><GiLinkedRings /> Играть с друзьями</button>
            <button className="btn secondary big" disabled={busy} onClick={() => play({ practice: true })}><GiRobotGrab /> Тренировка с ботами</button>
            <div className="join-row"><input value={code} maxLength={6} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-F0-9]/g, ''))} placeholder="КОД КОМНАТЫ" /><button className="btn ghost" disabled={busy || code.length < 6} onClick={() => play({ code })}>Войти</button></div>
            {error && <p className="err">{error}</p>}
          </div>
        </div>
        <div className="menu-right">
          <div className="howto">
            <div><GiLockPicking /><b>Взламывай</b><span>Зажми <kbd>E</kbd> у витрины. Сработает сирена — дроны летят на звук.</span></div>
            <div><GiSecretDoor /><b>Прячься</b><span>Шкаф скрывает тебя на 5 секунд — дроны теряют след.</span></div>
            <div><GiPunch /><b>Отбирай</b><span>Толкни соперника — половина его добычи выпадет на пол.</span></div>
            <div><GiExitDoor /><b>Выноси</b><span>Очки дают только за добычу, вынесенную через открытый выход.</span></div>
          </div>
        </div>
        <div className="menu-bottom"><button className="chip" onClick={() => { setModal('settings'); sfx('click'); }}><GiSettingsKnobs /> Настройки</button><button className="chip" onClick={() => { setModal('credits'); sfx('click'); }}>Авторы моделей</button><span className="ver">v2.0</span></div>
      </section>}

      {screen === 'room' && !S && <div className="loader"><div className="spinner" /><p>Подключаемся к серверу…</p></div>}

      {/* ---------- ЛОББИ */}
      {screen === 'room' && phase === 'lobby' && <section className="lobby">
        <header className="lobby-head">
          <button className="btn ghost small" onClick={leave}>← Выйти</button>
          <div className="room-code" onClick={copy}><small>КОД КОМНАТЫ</small><b>{S.code}</b><span>{copied ? 'Ссылка скопирована!' : 'Нажми, чтобы скопировать приглашение'}</span></div>
          {ping > 0 && <div className="ping">{ping} мс</div>}
        </header>
        <div className="lobby-body">
          <div className="slots">
            {Array.from({ length: 8 }).map((_, i) => { const p = S.roster[i]; return p ? <div key={p.id} className={`slot ${p.ready || p.id === S.owner ? 'ready' : ''} ${p.id === myId ? 'me' : ''}`} style={{ '--c': p.color }}>
              <div className="avatar"><GiRobberMask /></div><div className="slot-name">{p.name}{p.id === myId && <em> (ты)</em>}</div>
              <div className="slot-tags">{p.id === S.owner && <span className="tag gold"><GiCrown /> Хост</span>}{p.bot && <span className="tag">Бот</span>}{!p.connected && <span className="tag red">нет связи</span>}{p.id !== S.owner && <span className={`tag ${p.ready ? 'green' : ''}`}>{p.ready ? 'Готов' : 'Ждём'}</span>}</div>
            </div> : <div key={i} className="slot empty">{owner ? <button onClick={() => { socket.current.emit('bot:add'); sfx('click'); }}>+ Добавить бота</button> : <span>Свободно</span>}</div>; })}
          </div>
          <div className="lobby-actions">
            {owner ? <>
              <button className="btn primary big" onClick={() => { socket.current.emit('start'); sfx('click'); }}><GiPlayButton /> Начать ограбление</button>
              <button className="btn ghost small" onClick={() => socket.current.emit('bot:remove')}>Убрать бота</button>
            </> : <button className={`btn big ${S.roster.find(r => r.id === myId)?.ready ? 'secondary' : 'primary'}`} onClick={() => { socket.current.emit('ready'); sfx('click'); }}>{S.roster.find(r => r.id === myId)?.ready ? <><GiCheckMark /> Готов</> : 'Я готов'}</button>}
            <p className="hint-text">{owner ? 'Отправь друзьям код или ссылку. Матч длится 3 минуты, до 8 игроков.' : 'Ждём, когда хост начнёт матч.'}</p>
          </div>
        </div>
      </section>}

      {/* ---------- ИГРОВОЙ HUD */}
      {screen === 'room' && S && (phase === 'playing' || phase === 'countdown') && <section className="hud">
        <div className="hud-top">
          <div className="me-card" style={{ '--c': me.color }}>
            <div className="avatar"><GiRobberMask /></div>
            <div className="me-info"><b>{me.name}</b><div className="score"><GiMoneyStack /> {me.score} <small>вынесено</small></div></div>
            <div className={`bag ${me.bag >= RULES.capacity ? 'full' : ''}`}><GiSwapBag /><div className="bag-bar"><i style={{ width: `${me.bag / RULES.capacity * 100}%` }} /></div><span>{me.bag}<small>/{RULES.capacity}</small></span></div>
          </div>
          <div className={`timer ${S.finale ? 'finale' : ''} ${S.time < 10 ? 'urgent' : ''}`}>
            <div className="time"><GiStopwatch /> {fmt(S.time)}</div>
            <div className="exit-info">{S.finale ? <><GiSiren /> ФИНАЛ · только {EXITS[S.activeExit].name}</> : <><GiExitDoor /> {EXITS[S.activeExit].name}<em> · смена через {Math.ceil(36 - S.nextExit)} с</em></>}</div>
          </div>
          <div className="board">
            {sorted.slice(0, 5).map((p, i) => <div key={p.id} className={`row ${p.id === myId ? 'me' : ''}`} style={{ '--c': p.color }}><span className="rank">{i === 0 && p.score > 0 ? <GiCrown /> : i + 1}</span><span className="dot" /><span className="nm">{p.name}</span><b>{p.score}</b></div>)}
            {sorted.findIndex(p => p.id === myId) >= 5 && <div className="row me" style={{ '--c': me.color }}><span className="rank">{sorted.findIndex(p => p.id === myId) + 1}</span><span className="dot" /><span className="nm">{me.name}</span><b>{me.score}</b></div>}
          </div>
        </div>
        {S.alarms.length > 0 && <div className="alarm-banner"><GiSiren /> ТРЕВОГА: {S.alarms[S.alarms.length - 1].room}</div>}
        <div className="feed">{S.feed.map(f => <div key={f.id} className={`feed-item ${f.kind}`}>{f.text}</div>)}</div>
        <canvas className="minimap" ref={mini} width={220} height={160} />
        <div className="hud-tools">{ping > 0 && <span className="ping">{ping} мс</span>}<button className="icon-btn" onClick={() => setModal('pause')}><GiPauseButton /></button></div>
        {!touch && <div className="abilities">
          <Ability icon={<GiLockPicking />} k="E" label={hint?.kind === 'hide' ? 'Спрятаться' : 'Взлом'} active={!!hint} />
          <Ability icon={<GiPunch />} k="ЛКМ" label="Толчок" cd={me.pushCd} max={RULES.pushCooldown} />
          <Ability icon={<GiSprint />} k="Space" label="Рывок" cd={me.dashCd} max={RULES.dashCooldown} />
          <Ability icon={<GiSecretDoor />} k="" label="Шкаф" cd={me.hideCd} max={RULES.hideCooldown} />
        </div>}
        {touch && <TouchControls input={input.current} socket={socket} hint={hint} me={me} />}
        {phase === 'countdown' && <div className="countdown"><b key={Math.ceil(S.countdown)}>{Math.ceil(S.countdown) > 0 ? Math.ceil(S.countdown) : 'ХАПАЙ!'}</b><span>Собери добычу и вынеси её через открытый выход</span></div>}
        {me.action?.type === 'hide' && <div className="hidden-overlay"><div className="slats" /><div className="hide-card"><GiHidden /><b>Ты в шкафу</b><div className="hide-ring"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" /><circle className="p" cx="40" cy="40" r="34" style={{ strokeDashoffset: 213.6 * (1 - me.action.left / RULES.hideTime) }} /></svg><span>{Math.ceil(me.action.left)}</span></div><small>Дроны тебя не видят</small></div></div>}
        {me.stunned && me.anim === 'caught' && <div className="caught-banner"><GiHandcuffs /><b>ПОЙМАН!</b><span>Добыча выпала. Встаёшь через {Math.ceil(me.stunLeft)} с</span></div>}
        {toast && <div className="toast">{toast}</div>}
      </section>}

      {/* ---------- РЕЗУЛЬТАТЫ */}
      {screen === 'room' && phase === 'results' && <section className="results">
        <div className="results-card">
          <h2><GiLaurelsTrophy /> Ограбление завершено</h2>
          <p className="winner">{sorted[0]?.score > 0 ? <>Победитель — <b style={{ color: sorted[0].color }}>{sorted[0].name}</b> с добычей {sorted[0].score} ◈</> : 'Никто ничего не вынес. Музей спокоен.'}</p>
          <div className="podium">{[1, 0, 2].map(i => sorted[i] && <div key={sorted[i].id} className={`pod p${i + 1}`} style={{ '--c': sorted[i].color }}><div className="avatar"><GiRobberMask /></div><b>{sorted[i].name}</b><span>{sorted[i].score} ◈</span><div className="block">{i + 1}</div></div>)}</div>
          <table className="stats"><thead><tr><th>Игрок</th><th title="Вынесено"><GiMoneyStack /></th><th title="Украдено"><GiSwapBag /></th><th title="Толчков"><GiPunch /></th><th title="Пойман"><GiHandcuffs /></th><th title="Пряток"><GiSecretDoor /></th></tr></thead>
            <tbody>{sorted.map(p => <tr key={p.id} className={p.id === myId ? 'me' : ''}><td><i style={{ background: p.color }} />{p.name}</td><td>{p.score}</td><td>{p.stats?.stolen ?? 0}</td><td>{p.stats?.pushes ?? 0}</td><td>{p.stats?.caught ?? 0}</td><td>{p.stats?.hides ?? 0}</td></tr>)}</tbody></table>
          <div className="results-actions">{owner ? <button className="btn primary big" onClick={() => { socket.current.emit('rematch'); sfx('click'); }}><GiPlayButton /> Реванш</button> : <p className="hint-text">Ждём, когда хост запустит реванш…</p>}<button className="btn ghost" onClick={leave}>В меню</button></div>
        </div>
      </section>}

      {/* ---------- МОДАЛКИ */}
      {modal && <div className="modal-bg" onClick={() => setModal(null)}><div className="modal" onClick={e => e.stopPropagation()}>
        {(modal === 'settings' || modal === 'pause') && <>
          <h3>{modal === 'pause' ? 'Пауза' : 'Настройки'}</h3>
          <label className="slider"><span><GiSpeaker /> Звуки</span><input type="range" min="0" max="1" step=".05" value={vol} onChange={e => { const v = +e.target.value; setVol(v); sound.current.unlock(); sound.current.setVolume(v); }} /></label>
          <label className="slider"><span><GiSpeaker /> Музыка</span><input type="range" min="0" max="1" step=".05" value={mus} onChange={e => { const v = +e.target.value; setMus(v); sound.current.unlock(); sound.current.setMusic(v); }} /></label>
          <div className="seg"><span>Графика</span>{[['low', 'Низкая'], ['medium', 'Средняя'], ['high', 'Высокая']].map(([q, l]) => <button key={q} className={quality === q ? 'on' : ''} onClick={() => setQ(q)}>{l}</button>)}</div>
          <div className="controls-help"><b>ПК:</b> WASD — движение · мышь — взгляд · <kbd>E</kbd> (удерживать) — взлом/шкаф · ЛКМ или <kbd>F</kbd> — толчок · <kbd>Space</kbd> — рывок<br /><b>Телефон:</b> левый стик — движение · свайп справа — взгляд · кнопки — действия</div>
          <div className="modal-actions">{modal === 'pause' && <button className="btn danger" onClick={leave}>Покинуть матч</button>}<button className="btn primary" onClick={() => setModal(null)}>Готово</button></div>
        </>}
        {modal === 'credits' && <>
          <h3>Авторы моделей</h3>
          <ul className="credits">
            <li><b>Thief</b> — UB artist, CC BY 4.0 (Sketchfab). Анимации — сделаны в Blender для ХАПАЙ!</li>
            <li><b>Museum Case</b> — Gamedirection, CC BY 4.0 (Sketchfab)</li>
            <li><b>Chair</b> — shuvalov.di; <b>fan</b> — Aditya31641; <b>Shield Kit</b> — Rookster (Sketchfab Standard)</li>
            <li>Экспонаты и мебель — <b>Poly Haven</b>, CC0</li>
            <li>Фургон и монеты — <b>Kenney</b>, CC0</li>
            <li>Корона, мешок, дрон, ограждения — сделаны в Blender для ХАПАЙ!</li>
          </ul>
          <div className="modal-actions"><button className="btn primary" onClick={() => setModal(null)}>Закрыть</button></div>
        </>}
      </div></div>}
    </main>
  );
}

function Ability({ icon, k, label, cd = 0, max = 1, active }) {
  const on = cd <= 0;
  return <div className={`ability ${on ? 'ready' : ''} ${active ? 'active' : ''}`}><div className="ab-icon">{icon}{!on && <div className="cd" style={{ '--p': cd / max }}><span>{Math.ceil(cd)}</span></div>}</div>{k && <kbd>{k}</kbd>}<small>{label}</small></div>;
}

function TouchControls({ input, socket, hint, me }) {
  const stick = useRef(null), knob = useRef(null), look = useRef(null), touchId = useRef(null), lookId = useRef(null), base = useRef({ x: 0, y: 0 }), lookBase = useRef(null);
  const start = e => { const t = e.changedTouches[0]; touchId.current = t.identifier; const r = stick.current.getBoundingClientRect(); base.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; moveT(e); };
  const moveT = e => { for (const t of e.changedTouches) if (t.identifier === touchId.current) { let dx = t.clientX - base.current.x, dy = t.clientY - base.current.y; const d = Math.hypot(dx, dy), m = 52; if (d > m) { dx = dx / d * m; dy = dy / d * m; } knob.current.style.transform = `translate(${dx}px, ${dy}px)`; input.touchMove = { x: dx / m, z: dy / m }; } };
  const end = e => { for (const t of e.changedTouches) if (t.identifier === touchId.current) { touchId.current = null; knob.current.style.transform = ''; input.touchMove = { x: 0, z: 0 }; } };
  const lstart = e => { const t = e.changedTouches[0]; lookId.current = t.identifier; lookBase.current = { x: t.clientX, y: t.clientY }; };
  const lmove = e => { for (const t of e.changedTouches) if (t.identifier === lookId.current) { const dx = t.clientX - lookBase.current.x, dy = t.clientY - lookBase.current.y; if (Math.hypot(dx, dy) > 14) input.touchLook = Math.atan2(dy, dx); } };
  const lend = e => { for (const t of e.changedTouches) if (t.identifier === lookId.current) { lookId.current = null; input.touchLook = null; } };
  const btn = (fn) => ({ onTouchStart: e => { e.preventDefault(); e.stopPropagation(); fn(true); }, onTouchEnd: e => { e.preventDefault(); fn(false); }, onTouchCancel: () => fn(false) });
  const label = hint?.kind === 'hide' ? 'Шкаф' : hint?.kind === 'steal' ? 'Взлом' : 'Действие';
  return <div className="touch-ui">
    <div className="look-zone" ref={look} onTouchStart={lstart} onTouchMove={lmove} onTouchEnd={lend} onTouchCancel={lend} />
    <div className="stick" ref={stick} onTouchStart={start} onTouchMove={moveT} onTouchEnd={end} onTouchCancel={end}><div className="knob" ref={knob} /></div>
    <div className="touch-buttons">
      <button className={`tb interact ${hint ? 'lit' : ''}`} {...btn(v => input.touchInteract = v)}>{hint?.kind === 'hide' ? <GiSecretDoor /> : <GiLockPicking />}<small>{label}</small></button>
      <button className={`tb push ${me.pushCd > 0 ? 'cool' : ''}`} {...btn(v => v && socket.current?.emit('action', 'push'))}><GiPunch />{me.pushCd > 0 && <span>{Math.ceil(me.pushCd)}</span>}</button>
      <button className={`tb dash ${me.dashCd > 0 ? 'cool' : ''}`} {...btn(v => v && socket.current?.emit('action', 'dash'))}><GiSprint />{me.dashCd > 0 && <span>{Math.ceil(me.dashCd)}</span>}</button>
    </div>
  </div>;
}
