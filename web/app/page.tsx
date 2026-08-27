'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export const dynamic = 'force-static';

type Player = {
  id: string; name: string; firstName: string; lastName: string;
  displayName?: string; registeredName?: string;
  club: string | null; clubBadgeUrl: string | null; position: string | null; shirtNumber: number | null;
  country: string | null; nationality: string | null; flagUrl: string | null;
  photoUrl: string; photoWidth: number;
};
type Dataset = { players: Player[]; count: number; collectedAt: string };
type Progress = Record<string, 'again' | 'known'>;
const STORAGE_KEY = 'player-lab-progress-v1';
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const publicUrl = (value: string | null) => value?.startsWith('/') ? `${BASE_PATH}${value}` : value ?? '';

const cardName = (player: Player) => {
  const displayName = (player.displayName ?? player.name).trim();
  const recordedSurname = player.lastName.trim();
  const surname = recordedSurname && displayName.toLocaleLowerCase().endsWith(recordedSurname.toLocaleLowerCase())
    ? recordedSurname
    : displayName.split(/\s+/).at(-1) ?? displayName;
  const givenName = displayName.slice(0, Math.max(0, displayName.length - surname.length)).trim();
  return { givenName, surname };
};

const shuffle = <T,>(items: T[]) => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [next[i], next[j]] = [next[j], next[i]]; }
  return next;
};

function MultiPicker({ label, options, values, onChange }: { label: string; options: string[]; values: string[]; onChange: (values: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggle = (value: string) => onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  const summary = values.length ? `${values.length} selected` : `All ${label.toLowerCase()}s`;

  useEffect(() => {
    const closeWhenOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeWhenOutside);
    return () => document.removeEventListener('pointerdown', closeWhenOutside);
  }, []);

  return <div className="filter-control" ref={menuRef}>
    <span className="filter-label">{label}</span>
    <button className={`filter-trigger ${values.length ? 'has-value' : ''}`} type="button" aria-expanded={open} onClick={() => setOpen((state) => !state)}><span>{summary}</span><b>⌄</b></button>
    {open && <div className="filter-menu" role="listbox" aria-multiselectable="true">
      <div className="filter-menu-head"><span>{label}</span>{values.length > 0 && <button type="button" onClick={() => onChange([])}>Clear</button>}</div>
      {options.map((option) => <button className={`filter-option ${values.includes(option) ? 'selected' : ''}`} key={option} type="button" role="option" aria-selected={values.includes(option)} onClick={() => toggle(option)}><i>{values.includes(option) ? '✓' : ''}</i><span>{option}</span></button>)}
    </div>}
  </div>;
}

export default function Home() {
  const [data, setData] = useState<Dataset>();
  const [progress, setProgress] = useState<Progress>(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); } catch { return {}; }
  });
  const [club, setClub] = useState<string[]>([]);
  const [position, setPosition] = useState<string[]>([]);
  const [country, setCountry] = useState<string[]>([]);
  const [hqOnly, setHqOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [queue, setQueue] = useState<string[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [cardSerial, setCardSerial] = useState(0);
  const [advanceNote, setAdvanceNote] = useState('');
  const [exitDirection, setExitDirection] = useState<'known' | 'again' | null>(null);
  const advanceTimer = useRef<number | null>(null);

  useEffect(() => {
    fetch(publicUrl('/data/premier-league-players-2026.json')).then((response) => response.json()).then(setData).catch(() => setData({ players: [], count: 0, collectedAt: '' }));
  }, []);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); }, [progress]);
  useEffect(() => () => { if (advanceTimer.current) window.clearTimeout(advanceTimer.current); }, []);

  const players = useMemo(() => data?.players ?? [], [data]);
  const deck = useMemo(() => players.filter((player) => {
    const words = `${player.name} ${player.displayName} ${player.registeredName} ${player.club} ${player.position} ${player.country}`.toLowerCase();
    return (club.length === 0 || club.includes(player.club ?? '')) && (position.length === 0 || position.includes(player.position ?? '')) &&
      (country.length === 0 || country.includes(player.country ?? '')) && (!hqOnly || player.photoWidth === 500) &&
      (!query || words.includes(query.toLowerCase()));
  }), [players, club, position, country, hqOnly, query]);
  const lookup = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const current = queue[0] ? lookup.get(queue[0]) : undefined;
  const currentCardName = current ? cardName(current) : undefined;
  const clubs = useMemo(() => [...new Set(players.map((player) => player.club).filter(Boolean))].sort(), [players]);
  const countries = useMemo(() => [...new Set(players.map((player) => player.country).filter(Boolean))].sort(), [players]);
  const positions = useMemo(() => [...new Set(players.map((player) => player.position).filter(Boolean))].sort(), [players]);
  const mastered = deck.filter((player) => progress[player.id] === 'known').length;
  const activeFilters = club.length + position.length + country.length + Number(hqOnly) + Number(Boolean(query));

  useEffect(() => {
    const timer = window.setTimeout(() => { setQueue(shuffle(deck.map((player) => player.id))); setFlipped(false); }, 0);
    return () => window.clearTimeout(timer);
  }, [deck]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName) || !current) return;
      if (event.key === ' ' || event.key === 'Enter' || event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); setFlipped((state) => !state); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); answer('again'); }
      if (event.key === 'ArrowRight') { event.preventDefault(); answer('known'); }
      if (event.key === '1') answer('again');
      if (event.key === '2') answer('known');
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  });

  function answer(rating: 'again' | 'known') {
    if (!current || exitDirection) return;
    setProgress((old) => ({ ...old, [current.id]: rating }));
    setExitDirection(rating);
    setAdvanceNote(rating === 'known' ? 'Cleared — next player' : 'Back in rotation — next player');
    advanceTimer.current = window.setTimeout(() => {
      setQueue((old) => { const rest = old.slice(1); return rating === 'known' ? rest : [...rest.slice(0, 3), current.id, ...rest.slice(3)]; });
      setFlipped(false);
      setCardSerial((serial) => serial + 1);
      setExitDirection(null);
      advanceTimer.current = null;
    }, 100);
  }
  const restart = () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    const ids = new Set(deck.map((player) => player.id));
    setProgress((old) => Object.fromEntries(Object.entries(old).filter(([id]) => !ids.has(id))));
    setQueue(shuffle(deck.map((player) => player.id)));
    setFlipped(false);
    setExitDirection(null);
    setAdvanceNote('Fresh deck — every player is back in');
  };
  const reset = restart;
  const clear = () => { setClub([]); setPosition([]); setCountry([]); setHqOnly(false); setQuery(''); };

  if (!data) return <main className="loading"><b>PL</b><span>Preparing your player deck…</span></main>;

  return <main className="app">
    <section className="hero" id="top"><div><a className="brand page-logo" href="#top"><b>PL</b><span><strong>PLAYER</strong> LAB</span></a><p className="eyebrow">Learn the league, one face at a time</p><h1>Who&rsquo;s <em>that</em> player?</h1><p>Train your Premier League memory with a repeat-until-you-know-it flashcard flow.</p></div><div className="deck-total"><b>{deck.length}</b><span>cards in this deck</span></div></section>
    <div className="layout" id="study">
      <aside className={`filters ${showFilters ? 'open' : ''}`} id="filters"><div className="filter-head"><div><p className="eyebrow">Build your deck</p><h2>Filters</h2></div><button onClick={clear}>Clear all</button></div>
        <label>Search player<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. Bukayo Saka" /></label>
        <MultiPicker label="Club" options={clubs as string[]} values={club} onChange={setClub} />
        <MultiPicker label="Position" options={positions as string[]} values={position} onChange={setPosition} />
        <MultiPicker label="Nationality" options={countries as string[]} values={country} onChange={setCountry} />
        <label className="quality-toggle"><input type="checkbox" checked={hqOnly} onChange={(event) => setHqOnly(event.target.checked)} />500px headshots only</label>
        <footer>{activeFilters ? `${activeFilters} active filter${activeFilters === 1 ? '' : 's'}` : 'Whole league selected'}<small>Progress stays on this device.</small></footer>
      </aside>
      <section className="stage" aria-live="polite"><div className="toolbar"><button className="filter-toggle" onClick={() => setShowFilters((state) => !state)}>☰ Filters {activeFilters ? `(${activeFilters})` : ''}</button><p><span>MASTERED</span><b>{mastered} / {deck.length}</b></p><button className="restart" onClick={restart}>↻ Restart deck</button></div><div className="meter"><span style={{ width: `${deck.length ? mastered / deck.length * 100 : 0}%` }} /></div>
        {!current && deck.length > 0 ? <div className="finish"><div>✦</div><p className="eyebrow">Deck complete</p><h2>Every card is cleared.</h2><p>You&rsquo;ve marked all {deck.length} players as known.</p><button onClick={restart}>Run it again</button><button className="plain" onClick={reset}>Reset progress</button></div>
        : current ? <><div className="counter"><span>Card {Math.max(deck.length - queue.length + 1, 1)} of {deck.length}</span><span>{advanceNote || (flipped ? 'Rate your recall' : 'Tap the card to reveal')}</span></div><div className="card-stack"><span className="stack-card stack-card-two" /><span className="stack-card stack-card-one" /><button key={`${current.id}-${cardSerial}`} className={`card card-arriving ${flipped ? 'flip' : ''} ${exitDirection ? `card-exit exit-${exitDirection}` : ''}`} tabIndex={-1} onClick={(event) => { event.currentTarget.blur(); if (!exitDirection) setFlipped((state) => !state); }} aria-label="Reveal player"><span className="card-inner">
          <span className="face front"><small>PLAYER LAB <i>01</i></small>{current.clubBadgeUrl && <img className="crest" src={publicUrl(current.clubBadgeUrl)} alt="" />}<span className="portrait"><img src={publicUrl(current.photoUrl)} alt={`Portrait of ${current.name}`} /></span><em>Tap to reveal ↗</em></span>
          <span className="face back"><small>SCOUTING REPORT <i>02</i></small><span className="identity"><img src={publicUrl(current.photoUrl)} alt="" /><span>{currentCardName?.givenName && <b>{currentCardName.givenName}</b>}<strong>{currentCardName?.surname}</strong>{current.registeredName && current.registeredName !== (current.displayName ?? current.name) && <em className="registered-name">{current.registeredName}</em>}</span></span><span className="facts"><span><b>Club</b><i>{current.clubBadgeUrl && <img src={publicUrl(current.clubBadgeUrl)} alt="" />}{current.club ?? '—'}</i></span><span><b>Position</b><i>{current.position ?? '—'}</i></span><span><b>Nationality</b><i>{current.flagUrl && <img src={publicUrl(current.flagUrl)} alt="" />}{current.nationality ?? current.country ?? '—'}</i></span><span><b>Squad number</b><i>{current.shirtNumber ? `#${current.shirtNumber}` : '—'}</i></span></span><em className="source">Official {current.photoWidth === 500 ? '500px' : 'directory'} photo</em></span>
        </span></button></div><div className="ratings"><button disabled={Boolean(exitDirection)} onClick={() => answer('again')}><i>1</i> Don&rsquo;t know yet</button><button disabled={Boolean(exitDirection)} onClick={() => answer('known')}><i>2</i> I know it</button></div><p className="keys" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '7px 12px' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><kbd>↑</kbd><kbd>↓</kbd><kbd>Space</kbd> flip</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><kbd>←</kbd><kbd>1</kbd> revisit</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><kbd>→</kbd><kbd>2</kbd> known</span></p></>
        : <div className="finish empty"><p className="eyebrow">No matching cards</p><h2>Try widening your filters.</h2><button onClick={clear}>Show all players</button></div>}</section>
      <aside className="how" id="how"><p className="eyebrow">Your study flow</p><h2>Remember it for real.</h2><ol><li><b>01</b><span>See the face first. Take your best guess.</span></li><li><b>02</b><span>Flip for the answer and player profile.</span></li><li><b>03</b><span>Known cards leave the queue; misses return soon.</span></li></ol><div className="roster"><b>{data.count}</b><span>players with verified photos<br />Saved in your browser</span></div></aside>
    </div>
  </main>;
}
