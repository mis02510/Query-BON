
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, RawRow, MilestoneInfo } from './types';
import { 
  CSV_QUERY_URL, 
  CSV_API_URL, 
  TICKET_API_URL,
  ADMIN_COLS, 
  USER_COLS, 
  ROWS_PER_PAGE, 
  STEPS 
} from './constants';
import { fetchCSV } from './services/dataService';
import { 
  LayoutDashboard, 
  LogOut, 
  RefreshCcw, 
  ChevronLeft, 
  ChevronRight, 
  X,
  AlertCircle,
  Clock,
  Key,
  User as UserIcon,
  Search,
  ArrowRight,
  WifiOff,
  Filter,
  MessageSquare,
  PlusCircle,
  Send,
  CheckCircle2,
  LayoutGrid
} from 'lucide-react';

// --- Shared UI Components ---

const Loader: React.FC = () => (
  <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-[1000] flex flex-col items-center justify-center fade-in">
    <div className="w-12 h-12 border-4 border-slate-100 border-t-sky-500 rounded-full animate-spin mb-4"></div>
    <p className="text-slate-500 font-extrabold text-[0.6rem] uppercase tracking-[0.2em]">Processing Request</p>
  </div>
);

const SyncError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 text-center bg-slate-50/50">
    <div className="w-16 h-16 md:w-20 md:h-20 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-red-500/10">
      <WifiOff size={32} strokeWidth={2.5} />
    </div>
    <h2 className="text-xl font-black text-slate-800 mb-3 tracking-tight">Sync Disconnected</h2>
    <p className="max-w-md text-slate-500 font-medium text-xs md:text-sm leading-relaxed mb-8">
      Check your Google Sheet "Publish to Web" settings.
    </p>
    <button onClick={onRetry} className="px-8 py-4 bg-slate-900 text-white font-black rounded-2xl flex items-center gap-3 hover:bg-black transition-all active:scale-95 text-xs tracking-widest uppercase">
      <RefreshCcw size={18} strokeWidth={2.5} />
      Retry Sync
    </button>
  </div>
);

const MilestoneCard: React.FC<{ index: number, step: any, row: RawRow, isFocus: boolean, isDone: boolean }> = ({ index, step, row, isFocus, isDone }) => {
  const planStr = row[step.p] || '-';
  const actualStr = row[step.a] || '-';
  const remarkVal = (row[step.r] || '').trim();
  const displayRemark = remarkVal !== '' ? remarkVal : 'Ongoing';
  
  return (
    <div className={`group relative bg-white rounded-2xl p-5 border transition-all duration-300 ${isFocus ? 'border-sky-200 shadow-[0_10px_30px_rgba(14,165,233,0.1)] ring-2 ring-sky-50' : 'border-slate-100 shadow-sm'}`}>
      {isFocus && <div className="absolute top-0 left-0 h-full w-1.5 bg-sky-500 rounded-l-2xl" />}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 pr-2">
          <h5 className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest mb-1">Step {index + 1}</h5>
          <h4 className={`text-[0.75rem] font-black uppercase tracking-tight leading-tight ${isFocus ? 'text-sky-600' : 'text-slate-700'}`}>{step.n}</h4>
        </div>
        <div className={`text-[0.6rem] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${isDone ? 'bg-emerald-50 text-emerald-600' : (isFocus ? 'bg-sky-50 text-sky-600 animate-pulse' : 'bg-slate-50 text-slate-400')}`}>
          {isDone ? 'Completed' : (isFocus ? 'In Progress' : 'Idle')}
        </div>
      </div>
      <div className={`mb-6 p-4 rounded-xl border flex gap-3 ${remarkVal === '' ? 'bg-amber-50/50 border-amber-100 text-amber-700' : 'bg-emerald-50/50 border-emerald-100 text-emerald-700'}`}>
        <div className="shrink-0 mt-0.5">{remarkVal === '' ? <Clock size={16} /> : <MessageSquare size={16} />}</div>
        <div className="space-y-0.5">
          <p className="text-[0.5rem] font-black uppercase tracking-[0.2em] opacity-60">STATUS UPDATE / REMARK</p>
          <p className="text-xs font-bold leading-tight">{displayRemark}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
        <div className="space-y-1">
          <p className="text-[0.55rem] font-bold text-slate-400 uppercase tracking-widest">Planned Delivery</p>
          <p className="text-[0.75rem] font-bold text-slate-700 truncate">{planStr}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[0.55rem] font-bold text-slate-400 uppercase tracking-widest">Actual Completion</p>
          <p className="text-[0.75rem] font-bold text-slate-700 truncate">{actualStr}</p>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loginForm, setLoginForm] = useState({ name: '', key: '' });
  const [loginError, setLoginError] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<RawRow[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<RawRow | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientFilter, setSelectedClientFilter] = useState('all');
  
  // Ticket Form State
  const [ticketForm, setTicketForm] = useState({ issueQuery: '' });
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState(false);

  const checkSession = useCallback(() => {
    const stored = localStorage.getItem('qc_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch (e) { localStorage.removeItem('qc_user'); }
    }
  }, []);

  useEffect(() => { checkSession(); }, [checkSession]);

  const getMilestoneStatus = useCallback((row: RawRow): MilestoneInfo => {
    let furthestRemarkIdx = -1;
    for (let i = STEPS.length - 1; i >= 0; i--) {
      if ((row[STEPS[i].r] || '').trim() !== '') {
        furthestRemarkIdx = i;
        break;
      }
    }
    const step5Remark = (row[STEPS[4].r] || '').trim();
    const isOverallComplete = step5Remark !== '';
    let statusLabel = isOverallComplete ? 'COMPLETE' : (furthestRemarkIdx >= 0 ? 'ACTIVE TICKET' : 'PROCESSING');
    let displayHeading = furthestRemarkIdx >= 0 ? (row[STEPS[furthestRemarkIdx].r] || '').trim() : 'PLEASE AWAIT INFORMATION';

    return { n: displayHeading, d: isOverallComplete, idx: furthestRemarkIdx, 
      // @ts-ignore
      customStatus: statusLabel };
  }, []);

  const fetchData = useCallback(async (u: User) => {
    setIsLoading(true);
    setSyncError(false);
    try {
      const rawRows = await fetchCSV(CSV_QUERY_URL(Date.now()));
      const filtered = rawRows.slice(6).filter(r => {
        const client = (r[2] || "").trim().toLowerCase();
        const issue = (r[3] || "").toLowerCase();
        if (!client || issue.includes("test")) return false;
        return u.isAdmin || client === u.name.toLowerCase();
      });
      setData(filtered);
    } catch (e) { setSyncError(true); } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { if (user) fetchData(user); }, [user, fetchData]);

  const handleLogin = async () => {
    if (!loginForm.name || !loginForm.key) return;
    setIsLoading(true);
    try {
      const users = await fetchCSV(CSV_API_URL(Date.now()));
      const found = users.slice(1).find(u => u[0].toLowerCase() === loginForm.name.toLowerCase() && u[1] === loginForm.key);
      if (found) {
        const u = { name: loginForm.name, isAdmin: loginForm.name.toUpperCase() === 'ADMIN' };
        setUser(u);
        localStorage.setItem('qc_user', JSON.stringify(u));
        setLoginError(false);
      } else { setLoginError(true); }
    } catch (e) { setLoginError(true); } finally { setIsLoading(false); }
  };

  const logout = () => {
    localStorage.removeItem('qc_user');
    setUser(null);
    setData([]);
    setLoginForm({ name: '', key: '' });
    setShowLogoutConfirm(false);
  };

  const handleRaiseTicket = async () => {
    if (!ticketForm.issueQuery.trim() || !user) return;
    setIsSubmittingTicket(true);
    try {
      const payload = {
        raisedBy: user.name,
        receivedBy: 'Deepak Kaushik',
        issueQuery: ticketForm.issueQuery
      };
      
      const response = await fetch(TICKET_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      setTicketSuccess(true);
      setTicketForm({ issueQuery: '' });
      setTimeout(() => {
        setIsTicketModalOpen(false);
        setTicketSuccess(false);
        fetchData(user); 
      }, 2000);
    } catch (e) {
      alert("Submission Error. Please check connectivity.");
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const filteredData = useMemo(() => {
    let result = [...data];
    if (selectedClientFilter !== 'all') result = result.filter(row => (row[2] || '').trim() === selectedClientFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(row => row.some(cell => cell.toLowerCase().includes(q)));
    }

    result.sort((a, b) => {
      // 1. Primary Sort: Ticket Raised (Index 0) - Max to Min (Newest first)
      const valA = a[0] || '';
      const valB = b[0] || '';
      
      // Attempt date parsing
      const dateA = new Date(valA).getTime();
      const dateB = new Date(valB).getTime();

      if (!isNaN(dateA) && !isNaN(dateB)) {
        if (dateA !== dateB) return dateB - dateA;
      } else {
        // Fallback to lexicographical if parsing fails
        if (valA !== valB) return valB.localeCompare(valA);
      }

      // 2. Secondary Sort: Status Priority
      const statusA = getMilestoneStatus(a);
      const statusB = getMilestoneStatus(b);
      
      // @ts-ignore
      const labelA = statusA.customStatus;
      // @ts-ignore
      const labelB = statusB.customStatus;

      const getWeight = (label: string) => {
        if (label === 'ACTIVE TICKET') return 0;
        if (label === 'PROCESSING') return 1;
        if (label === 'COMPLETE') return 2;
        return 3;
      };

      const weightA = getWeight(labelA);
      const weightB = getWeight(labelB);

      if (weightA !== weightB) {
        return weightA - weightB;
      }
      return 0;
    });

    return result;
  }, [data, searchQuery, selectedClientFilter, getMilestoneStatus]);

  const paginatedData = useMemo(() => filteredData.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE), [filteredData, currentPage]);
  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE) || 1;

  if (!user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#f0f4f8] p-6 text-slate-800">
        <div className="w-full max-w-[440px] bg-white rounded-[3.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] p-12 border border-slate-50 relative overflow-hidden slide-up">
          {isLoading && <Loader />}
          <div className="text-center mb-12">
            <div className="inline-flex p-5 bg-[#eef8ff] text-[#0ea5e9] rounded-[1.5rem] mb-8 shadow-sm">
              <LayoutGrid size={44} strokeWidth={2} />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#1e293b] mb-2">Query Command</h1>
            <p className="text-[#94a3b8] text-[0.7rem] font-bold tracking-[0.15em] uppercase">Elite Client Interface</p>
          </div>
          <div className="space-y-5">
            <div className="relative group">
              <input 
                type="text" 
                placeholder="Identity Reference" 
                className="w-full px-8 py-5 bg-[#f8fafc] border border-slate-100 rounded-[1.5rem] focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-bold text-slate-700 placeholder:text-slate-300 transition-all" 
                value={loginForm.name} 
                onChange={e => setLoginForm(prev => ({ ...prev, name: e.target.value }))} 
              />
            </div>
            <div className="relative group">
              <input 
                type="password" 
                placeholder="Security Credential" 
                className="w-full px-8 py-5 bg-[#f8fafc] border border-slate-100 rounded-[1.5rem] focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-bold text-slate-700 placeholder:text-slate-300 transition-all" 
                value={loginForm.key} 
                onChange={e => setLoginForm(prev => ({ ...prev, key: e.target.value }))} 
              />
            </div>
            <button 
              onClick={handleLogin} 
              className="w-full py-6 bg-[#0f172a] hover:bg-black text-white font-black rounded-[1.5rem] shadow-xl transition-all flex items-center justify-center gap-4 text-xs tracking-[0.2em] uppercase mt-4 active:scale-95"
            >
              AUTHENTICATE ACCESS 
              <ArrowRight size={20} strokeWidth={2.5} />
            </button>
            {loginError && (
              <div className="p-4 bg-red-50 rounded-2xl flex items-center gap-3 text-red-600 fade-in">
                <AlertCircle size={18} /> 
                <span className="text-[0.6rem] font-black uppercase tracking-widest">Authentication Denied</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col p-4 lg:p-8 bg-slate-100 overflow-hidden text-slate-800">
      <div className="bg-white rounded-[2.5rem] shadow-2xl flex flex-col h-full border border-slate-200 overflow-hidden relative slide-up">
        {isLoading && <Loader />}
        <header className="px-8 py-6 border-b border-slate-50 flex flex-wrap justify-between items-center gap-4 bg-white/90 backdrop-blur-xl z-30">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-sky-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-sky-500/30"><LayoutDashboard size={24} strokeWidth={2.5} /></div>
            <div className="min-w-0">
              <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none uppercase">Query Hub</h1>
              <div className="mt-1.5 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div><span className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">{user.name}</span></div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsTicketModalOpen(true)}
              className="flex items-center gap-2 px-5 py-3 bg-sky-500 text-white font-black rounded-xl shadow-lg shadow-sky-500/20 hover:bg-sky-600 transition-all active:scale-95 text-[0.65rem] tracking-widest uppercase"
            >
              <PlusCircle size={18} />
              Raise Ticket
            </button>

            <div className="relative group hidden sm:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input type="text" placeholder="Filter..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="pl-11 pr-4 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold w-[160px]" />
            </div>
            <button onClick={() => fetchData(user)} className="p-3 bg-slate-50 text-slate-400 hover:text-sky-500 rounded-xl"><RefreshCcw size={18} strokeWidth={2.5} /></button>
            <button onClick={() => setShowLogoutConfirm(true)} className="px-5 py-3 bg-slate-900 text-white rounded-xl text-[0.65rem] font-black flex items-center gap-3">Log Out</button>
          </div>
        </header>

        <div className="flex-1 overflow-auto custom-scrollbar flex flex-col">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="sticky top-0 bg-white z-20 border-b border-slate-100">
              <tr>
                {(user.isAdmin ? ADMIN_COLS : USER_COLS).map(col => (
                  <th key={col.l} className="px-8 py-5 text-[0.6rem] font-black text-slate-400 uppercase tracking-[0.2em]">{col.l}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedData.map((row, ridx) => {
                const info = getMilestoneStatus(row);
                // @ts-ignore
                const sL = info.customStatus;
                const sC = sL === 'COMPLETE' ? 'text-emerald-500' : (sL === 'ACTIVE TICKET' ? 'text-sky-500' : 'text-amber-500');
                return (
                  <tr key={ridx} className="group hover:bg-slate-50/50 transition-all">
                    {(user.isAdmin ? ADMIN_COLS : USER_COLS).map((col, cidx) => {
                      if (col.i === -1) return <td key={cidx} className="px-8 py-5"><button onClick={() => { setSelectedRow(row); setIsDrawerOpen(true); }} className="px-6 py-2 bg-white text-slate-800 border-2 rounded-xl text-[0.6rem] font-black hover:bg-slate-900 hover:text-white transition-all uppercase tracking-widest">Tracking</button></td>;
                      if (col.i === -2) return <td key={cidx} className="px-8 py-5"><div className="text-[0.75rem] font-black text-slate-700 uppercase line-clamp-2">{info.n}</div><div className={`text-[0.55rem] font-black uppercase tracking-widest mt-1 ${sC}`}>{sL}</div></td>;
                      return <td key={cidx} className="px-8 py-5 text-[0.75rem] text-slate-600 font-bold max-w-[300px] truncate">{row[col.i] || '-'}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <footer className="px-12 py-4 border-t border-slate-50 flex justify-between items-center bg-white">
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="px-4 py-2 bg-slate-50 text-slate-400 font-black text-[0.65rem] uppercase tracking-widest rounded-xl disabled:opacity-20">Prev</button>
          <span className="text-[0.85rem] font-bold text-slate-800 tracking-[0.2em]">{currentPage} / {totalPages}</span>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-4 py-2 bg-slate-50 text-slate-400 font-black text-[0.65rem] uppercase tracking-widest rounded-xl disabled:opacity-20">Next</button>
        </footer>

        {/* Raise Ticket Modal */}
        {isTicketModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[2000] flex items-center justify-center p-6 fade-in">
            <div className="bg-white rounded-[3.5rem] p-12 max-w-lg w-full shadow-2xl relative slide-up border border-slate-50">
              {isSubmittingTicket && <Loader />}
              <div className="flex justify-between items-start mb-10">
                <div className="space-y-2">
                  <span className="text-[0.6rem] font-black text-sky-500 uppercase tracking-[0.4em]">New Inquiry</span>
                  <h2 className="text-3xl font-black text-slate-800 tracking-tight">Raise Ticket</h2>
                </div>
                <button onClick={() => setIsTicketModalOpen(false)} className="p-3 text-slate-300 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all"><X size={24} strokeWidth={2.5}/></button>
              </div>

              {ticketSuccess ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center shadow-inner mb-2"><CheckCircle2 size={40} /></div>
                  <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Submitted!</h3>
                  <p className="text-slate-500 font-bold text-sm tracking-wide">Professional notification sent to MIS Team.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[0.55rem] font-black text-slate-400 uppercase tracking-widest ml-1">Issue / Query</label>
                    <textarea 
                      placeholder="Explain your inquiry in detail..."
                      className="w-full px-8 py-6 bg-slate-50 border border-slate-200 rounded-[1.5rem] focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 font-bold text-sm min-h-[150px] transition-all"
                      value={ticketForm.issueQuery}
                      onChange={e => setTicketForm({ issueQuery: e.target.value })}
                    />
                  </div>
                  <button 
                    disabled={!ticketForm.issueQuery.trim()}
                    onClick={handleRaiseTicket}
                    className="w-full py-6 bg-slate-900 hover:bg-black text-white font-black rounded-[1.5rem] shadow-xl transition-all flex items-center justify-center gap-3 tracking-[0.2em] text-[0.7rem] uppercase active:scale-95 disabled:opacity-20 disabled:pointer-events-none"
                  >
                    SEND TICKET
                    <Send size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tracking Drawer */}
        <div className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] transition-opacity duration-500 ${isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsDrawerOpen(false)} />
        <aside className={`fixed top-0 right-0 h-full w-full md:max-w-[500px] bg-slate-50 shadow-2xl z-[200] flex flex-col transition-transform duration-500 transform ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          {selectedRow && (
            <>
              <div className="p-10 bg-white border-b border-slate-100 flex justify-between items-start">
                <div className="space-y-2">
                  <span className="text-[0.6rem] font-black text-sky-500 uppercase tracking-[0.4em]">Tracking Monitor</span>
                  <h2 className="text-2xl font-black text-slate-800 leading-tight">{selectedRow[6] || 'TICKET'}</h2>
                </div>
                <button onClick={() => setIsDrawerOpen(false)} className="p-3 text-slate-300 hover:text-slate-900 rounded-2xl"><X size={28} strokeWidth={2.5}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar">
                {STEPS.map((step, i) => {
                  const statusStr = (selectedRow[step.s] || '').trim().toLowerCase();
                  const actualVal = (selectedRow[step.a] || '').trim();
                  const isDone = statusStr.includes('done') || (actualVal !== '-' && actualVal !== '');
                  const currentInfo = getMilestoneStatus(selectedRow);
                  const isFocus = (currentInfo.idx === i);
                  return <MilestoneCard key={step.n} index={i} step={step} row={selectedRow} isFocus={isFocus} isDone={isDone} />;
                })}
              </div>
            </>
          )}
        </aside>

        {showLogoutConfirm && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[2000] flex items-center justify-center p-6 fade-in">
            <div className="bg-white rounded-[3.5rem] p-12 max-w-[440px] w-full shadow-2xl slide-up relative overflow-hidden border border-slate-50">
              <div className="w-20 h-20 bg-[#fff5f5] text-[#ff4d4d] rounded-3xl flex items-center justify-center mx-auto mb-8">
                <LogOut size={42} strokeWidth={2.5} />
              </div>
              <h3 className="text-3xl font-extrabold text-center mb-2 tracking-tight text-[#1e293b]">Log Out?</h3>
              <p className="text-[#94a3b8] font-bold text-center mb-10 text-[0.7rem] uppercase tracking-[0.3em]">End secure session?</p>
              
              <div className="flex flex-col gap-4">
                <button 
                  onClick={logout} 
                  className="w-full py-6 bg-[#ff4d4d] hover:bg-[#ff3333] text-white font-bold rounded-[1.5rem] uppercase tracking-[0.2em] text-[0.8rem] shadow-[0_15px_35px_rgba(255,77,77,0.3)] transition-all active:scale-95"
                >
                  Logout
                </button>
                <button 
                  onClick={() => setShowLogoutConfirm(false)} 
                  className="w-full py-6 bg-[#f8fafc] hover:bg-slate-100 text-[#64748b] font-bold rounded-[1.5rem] uppercase tracking-[0.2em] text-[0.8rem] transition-all"
                >
                  Stay
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
