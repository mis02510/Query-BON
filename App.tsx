
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
  X,
  Clock,
  Search,
  ArrowRight,
  PlusCircle,
  Send,
  CheckCircle2,
  LayoutGrid,
  RotateCcw,
  History,
  Users,
  AlertTriangle
} from 'lucide-react';

// --- Shared UI Components ---

const Loader: React.FC = () => (
  <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-[1000] flex flex-col items-center justify-center fade-in">
    <div className="w-10 h-10 border-4 border-orange-50 border-t-[#f36f21] rounded-full animate-spin mb-4"></div>
    <p className="text-[#f36f21] font-bold text-[0.6rem] uppercase tracking-widest">Syncing Dashboard</p>
  </div>
);

const MilestoneCard: React.FC<{ index: number, step: any, row: RawRow, isFocus: boolean, isDone: boolean }> = ({ index, step, row, isFocus, isDone }) => {
  const planStr = row[step.p] || '-';
  const actualStr = row[step.a] || '-';
  const remarkVal = (row[step.r] || '').trim();
  const displayRemark = remarkVal !== '' ? remarkVal : 'Processing';
  
  // Earth-tone colors matching the bar charts in the second image
  const colors = [
    'text-[#f36f21]', // Vibrant Orange
    'text-[#e44d26]', // Red-Orange
    'text-[#802b00]', // Mid Brown
    'text-[#4a1a00]', // Dark Brown
    'text-[#2b0f00]'  // Deepest Brown
  ];
  const stepColor = colors[index % colors.length];

  return (
    <div className={`group relative bg-white rounded-2xl p-5 border transition-all duration-300 ${isFocus ? 'border-[#f36f21]/20 shadow-lg' : 'border-slate-100'}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h5 className="text-[0.55rem] font-bold text-slate-400 uppercase tracking-widest mb-1">Step {index + 1}</h5>
          <h4 className={`text-[0.7rem] font-black uppercase tracking-tight ${isFocus ? stepColor : 'text-slate-700'}`}>{step.n}</h4>
        </div>
        <div className={`text-[0.55rem] font-black px-3 py-1 rounded-full uppercase tracking-widest ${isDone ? 'bg-orange-50 text-[#f36f21]' : (isFocus ? 'bg-[#fff7ed] text-[#f97316] animate-pulse' : 'bg-slate-50 text-slate-400')}`}>
          {isDone ? 'Finished' : (isFocus ? 'Active' : 'Queued')}
        </div>
      </div>
      <div className={`mb-4 p-3 rounded-xl border text-[0.7rem] font-bold flex gap-2 ${remarkVal === '' ? 'bg-[#fff7ed] border-[#ffedd5] text-[#f97316]' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
        <Clock size={14} className="shrink-0 mt-0.5" />
        <span>{displayRemark}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-50">
        <div>
          <p className="text-[0.5rem] font-bold text-slate-300 uppercase tracking-widest">Plan</p>
          <p className="text-[0.65rem] font-bold text-slate-600">{planStr}</p>
        </div>
        <div>
          <p className="text-[0.5rem] font-bold text-slate-300 uppercase tracking-widest">Actual</p>
          <p className="text-[0.65rem] font-bold text-slate-600">{actualStr}</p>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loginForm, setLoginForm] = useState({ name: '', key: '' });
  const [loginError, setLoginError] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [data, setData] = useState<RawRow[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<RawRow | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [clientFilter, setClientFilter] = useState('ALL');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  
  const [reopenReason, setReopenReason] = useState('');
  const [isSubmittingReopen, setIsSubmittingReopen] = useState(false);
  const [reopenSuccess, setReopenSuccess] = useState(false);
  const [validatedRow, setValidatedRow] = useState<RawRow | null>(null);

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
    let statusLabel = isOverallComplete ? 'CLOSED' : 'PROCESSING';
    let displayHeading = furthestRemarkIdx >= 0 ? (row[STEPS[furthestRemarkIdx].r] || '').trim().toUpperCase() : 'PLEASE AWAIT...';

    return { n: displayHeading, d: isOverallComplete, idx: furthestRemarkIdx, 
      // @ts-ignore
      customStatus: statusLabel };
  }, []);

  const fetchData = useCallback(async (u: User, silent: boolean = false) => {
    if (silent) setIsBackgroundSyncing(true);
    else setIsLoading(true);
    
    setFetchError(null);
    try {
      const rawRows = await fetchCSV(CSV_QUERY_URL(Date.now()));
      if (!rawRows || rawRows.length < 6) {
        throw new Error("Invalid CSV format or empty sheet.");
      }
      const filtered = rawRows.slice(6).filter(r => {
        const client = (r[2] || "").trim().toLowerCase();
        const issue = (r[3] || "").toLowerCase();
        if (!client || issue.includes("test")) return false;
        return u.isAdmin || client === u.name.toLowerCase();
      });
      setData(filtered);
      
      const now = new Date();
      setLastUpdated(now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
    } catch (e: any) { 
      console.error("Fetch Error:", e);
      setFetchError(e?.message || "Failed to fetch data. Please check your network or sheet permissions.");
    } finally { 
      setIsLoading(false); 
      setIsBackgroundSyncing(false);
    }
  }, []);

  useEffect(() => { 
    if (user) {
      fetchData(user); 
      const interval = setInterval(() => fetchData(user, true), 60000);
      return () => clearInterval(interval);
    }
  }, [user, fetchData]);

  const handleLogin = async () => {
    if (!loginForm.name || !loginForm.key) return;
    setIsLoading(true);
    setFetchError(null);
    try {
      const users = await fetchCSV(CSV_API_URL(Date.now()));
      const found = users.slice(1).find(u => u[0].toLowerCase() === loginForm.name.toLowerCase() && u[1] === loginForm.key);
      if (found) {
        const u = { name: loginForm.name, isAdmin: loginForm.name.toUpperCase() === 'ADMIN' };
        setUser(u);
        localStorage.setItem('qc_user', JSON.stringify(u));
        setLoginError(false);
      } else { setLoginError(true); }
    } catch (e: any) { 
      setFetchError("Login Failed: Network error while verifying credentials.");
      setLoginError(true); 
    } finally { setIsLoading(false); }
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
      const payload = { raisedBy: user.name, receivedBy: 'Deepak Kaushik', issueQuery: ticketForm.issueQuery };
      // Note: no-cors prevents reading the response but allows the request to be sent to GAS.
      await fetch(TICKET_API_URL, { 
        method: 'POST', 
        mode: 'no-cors', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      setTicketSuccess(true);
      setTicketForm({ issueQuery: '' });
      setTimeout(() => { setIsTicketModalOpen(false); setTicketSuccess(false); fetchData(user); }, 1500);
    } catch (e) { 
      alert("Submission Error. Please try again later."); 
    } finally { setIsSubmittingTicket(false); }
  };

  const handleReopenSubmit = async () => {
    if (!reopenReason.trim() || !user || !validatedRow) return;
    setIsSubmittingReopen(true);
    try {
      const payload = { 
        raisedBy: user.name, 
        receivedBy: 'MIS TEAM (RE-OPEN)', 
        issueQuery: `[RE-OPEN REQUEST FOR ${validatedRow[6]}] - Reason: ${reopenReason}`,
        originalTicketNo: validatedRow[6]
      };
      await fetch(TICKET_API_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      setReopenSuccess(true);
      setTimeout(() => {
        setIsReopenModalOpen(false);
        setReopenSuccess(false);
        setReopenReason('');
        setValidatedRow(null);
      }, 2000);
    } catch (e) { 
      alert("Error sending re-open request."); 
    } finally { setIsSubmittingReopen(false); }
  };

  const uniqueClients = useMemo(() => {
    const clients = new Set<string>();
    data.forEach(row => {
      const clientName = (row[2] || '').trim();
      if (clientName) clients.add(clientName);
    });
    return Array.from(clients).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    let result = [...data];
    if (user?.isAdmin && clientFilter !== 'ALL') {
      result = result.filter(row => (row[2] || '').trim() === clientFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(row => row.some(cell => cell.toLowerCase().includes(q)));
    }
    return result;
  }, [data, searchQuery, clientFilter, user]);

  const paginatedData = useMemo(() => filteredData.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE), [filteredData, currentPage]);
  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE) || 1;

  if (!user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#f8fafc] p-6">
        <div className="w-full max-w-[420px] bg-white rounded-[3rem] shadow-xl p-10 relative overflow-hidden slide-up border border-slate-100">
          {isLoading && <Loader />}
          <div className="text-center mb-10">
            <div className="inline-flex p-4 bg-orange-50 text-[#f36f21] rounded-2xl mb-6"><LayoutGrid size={40} /></div>
            <h1 className="text-2xl font-black tracking-tight text-[#1e293b] uppercase">Bonhoeffer Systems</h1>
            <p className="text-slate-400 text-[0.6rem] font-bold tracking-[0.2em] uppercase mt-2">Elite Partner Verification</p>
          </div>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Member Reference</label>
              <input type="text" placeholder="Username" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-[#f36f21] font-bold text-slate-700 transition-all" value={loginForm.name} onChange={e => setLoginForm(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Access Passphrase</label>
              <input type="password" placeholder="••••••••" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-[#f36f21] font-bold text-slate-700 transition-all" value={loginForm.key} onChange={e => setLoginForm(prev => ({ ...prev, key: e.target.value }))} />
            </div>
            <button onClick={handleLogin} className="w-full py-5 bg-[#f36f21] hover:bg-[#e44d26] text-white font-black rounded-2xl shadow-lg shadow-orange-500/10 transition-all flex items-center justify-center gap-3 text-[0.7rem] tracking-[0.2em] uppercase mt-4">Verify Identity <ArrowRight size={18} /></button>
            {loginError && <div className="p-3 bg-red-50 rounded-xl text-red-500 text-[0.6rem] font-black uppercase text-center border border-red-100 mt-2">Unauthorized Access Attempt</div>}
            {fetchError && <div className="p-3 bg-red-50 rounded-xl text-red-600 text-[0.55rem] font-bold text-center border border-red-100 mt-2">{fetchError}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-[#f8fafc] overflow-hidden text-slate-800">
      <div className="flex flex-col h-full relative">
        {(isLoading && !isBackgroundSyncing) && <Loader />}
        
        <header className="px-10 py-5 bg-white border-b border-slate-100 flex items-center gap-6 z-30">
          <div className="flex items-center gap-3 mr-auto">
            <div className="w-11 h-11 bg-[#f36f21] text-white rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/10"><LayoutDashboard size={22} /></div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-none">
                <span className="text-[#f36f21]">Welcome,</span> <span className="text-[#1e293b]">{user.name}</span>
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${fetchError ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`}></div>
                <span className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">
                  {fetchError ? 'Sync Error Detected' : 'Live Updates Active'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={() => setIsTicketModalOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-[#f36f21] text-white font-bold rounded-xl shadow-lg shadow-orange-500/10 hover:bg-[#e44d26] transition-all text-[0.65rem] tracking-widest uppercase">
              <PlusCircle size={16} /> Raise Ticket
            </button>
            
            {user.isAdmin && (
              <div className="relative group">
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-[#f36f21]/40" size={14} />
                <select 
                  value={clientFilter} 
                  onChange={e => { setClientFilter(e.target.value); setCurrentPage(1); }}
                  className="pl-10 pr-8 py-3 bg-[#fff7ed] border border-[#ffedd5] rounded-xl text-[0.65rem] font-bold uppercase tracking-widest appearance-none focus:outline-none focus:ring-2 focus:ring-[#f36f21]/10 transition-all cursor-pointer text-[#f97316] shadow-sm"
                >
                  <option value="ALL">All Clients</option>
                  {uniqueClients.map(client => <option key={client} value={client}>{client}</option>)}
                </select>
              </div>
            )}

            <div className="relative hidden lg:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
              <input 
                type="text" 
                placeholder="Search Records..." 
                value={searchQuery} 
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} 
                className="pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[0.65rem] font-bold w-[180px] focus:outline-none focus:ring-2 focus:ring-[#f36f21]/10 transition-all shadow-sm" 
              />
            </div>

            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-sm transition-colors ${fetchError ? 'bg-red-50 border-red-100' : 'bg-[#fff7ed] border-[#ffedd5]'}`}>
              <span className={`text-[0.6rem] font-black uppercase tracking-widest ${fetchError ? 'text-red-500' : 'text-[#f36f21]'}`}>
                {fetchError ? 'Sync Failed' : `Updated: ${lastUpdated || 'Syncing'}`}
              </span>
              <button onClick={() => fetchData(user)} className={`p-0.5 transition-all ${isBackgroundSyncing ? 'animate-spin text-[#f36f21]' : 'text-slate-300 hover:text-[#f36f21]'}`}>
                <RefreshCcw size={16} />
              </button>
            </div>
            
            <button onClick={() => setShowLogoutConfirm(true)} className="flex items-center gap-2 px-6 py-3 bg-[#fff1f2] text-[#991b1b] rounded-xl text-[0.65rem] font-black hover:bg-[#ffe4e6] transition-all uppercase tracking-widest border border-[#fecdd3]">
              <LogOut size={16} /> Logout
            </button>
          </div>
        </header>

        {fetchError && (
          <div className="mx-10 mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between text-red-700 animate-pulse">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} />
              <p className="text-xs font-bold uppercase tracking-wide">{fetchError}</p>
            </div>
            <button onClick={() => fetchData(user)} className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-[0.6rem] font-black uppercase hover:bg-red-700 transition-all">Retry Now</button>
          </div>
        )}

        <div className="flex-1 overflow-auto custom-scrollbar bg-white mt-4">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead className="sticky top-0 bg-white z-20 border-b border-slate-100">
              <tr>
                {(user.isAdmin ? ADMIN_COLS : USER_COLS).map(col => (
                  <th key={col.l} className="px-6 py-6 text-[0.55rem] font-black text-slate-400 uppercase tracking-[0.2em]">{col.l}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedData.map((row, ridx) => {
                const info = getMilestoneStatus(row);
                // @ts-ignore
                const sL = info.customStatus;
                const isClosed = sL === 'CLOSED';
                
                return (
                  <tr key={ridx} className="hover:bg-slate-50/50 transition-all group">
                    {(user.isAdmin ? ADMIN_COLS : USER_COLS).map((col, cidx) => {
                      if (col.i === -1) return (
                        <td key={cidx} className="px-6 py-5">
                          <button onClick={() => { setSelectedRow(row); setIsDrawerOpen(true); }} className="px-4 py-2 border border-slate-200 rounded-full text-[0.55rem] font-black text-slate-500 hover:bg-white hover:border-[#f36f21] hover:text-[#f36f21] transition-all uppercase tracking-widest shadow-sm">Tracking</button>
                        </td>
                      );
                      if (col.i === -2) return (
                        <td key={cidx} className="px-6 py-5">
                          <div className="text-[0.65rem] font-black text-slate-800 uppercase mb-1.5 leading-none">{info.n}</div>
                          <div className={`inline-flex items-center text-[0.55rem] font-black uppercase tracking-widest px-2.5 py-1 rounded-md ${isClosed ? 'bg-emerald-50 text-emerald-600' : 'bg-[#fff7ed] text-[#f97316]'}`}>
                            {sL}
                          </div>
                        </td>
                      );
                      if (col.i === -3) return (
                        <td key={cidx} className="px-6 py-5">
                          <button 
                            disabled={!isClosed}
                            onClick={() => { setValidatedRow(row); setIsReopenModalOpen(true); }} 
                            className={`p-2 rounded-lg transition-all ${isClosed ? 'text-[#f36f21] hover:bg-orange-50' : 'text-slate-200 cursor-not-allowed'}`}
                          >
                            <RotateCcw size={16} strokeWidth={3} />
                          </button>
                        </td>
                      );
                      const isIssueCol = col.i === 3;
                      const isBoldCol = col.i === 0 || col.i === 6;
                      return (
                        <td key={cidx} className={`px-6 py-5 text-[0.65rem] ${isBoldCol ? 'text-slate-800 font-bold' : 'text-slate-500 font-medium'} ${isIssueCol ? 'max-w-[380px]' : 'truncate max-w-[160px]'}`}>
                          {row[col.i] || '-'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {paginatedData.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={10} className="py-20 text-center">
                    <div className="flex flex-col items-center opacity-30">
                      <Search size={48} className="mb-4" />
                      <p className="text-xs font-bold uppercase tracking-widest">No matching records found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="px-10 py-6 bg-white border-t border-slate-100 flex justify-between items-center z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="text-[0.6rem] font-black uppercase tracking-[0.2em] text-slate-300 hover:text-[#f36f21] disabled:opacity-0 transition-all px-4 py-2">Prev</button>
          <div className="text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.3em]">Page <span className="text-[#f36f21]">{currentPage}</span> / <span className="text-slate-800">{totalPages}</span></div>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="text-[0.6rem] font-black uppercase tracking-[0.2em] text-slate-300 hover:text-[#f36f21] disabled:opacity-0 transition-all px-4 py-2">Next</button>
        </footer>

        {/* Modal: Re-open */}
        {isReopenModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[2000] flex items-center justify-center p-6 fade-in">
            <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl relative slide-up border border-slate-100">
              {isSubmittingReopen && <Loader />}
              <div className="flex justify-between items-start mb-8">
                <div>
                  <span className="text-[0.55rem] font-black text-[#f36f21] uppercase tracking-[0.3em]">Escalation Portal</span>
                  <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Re-Open Inquiry</h2>
                </div>
                <button onClick={() => { setIsReopenModalOpen(false); setReopenReason(''); }} className="p-2 text-slate-300 hover:text-slate-800 transition-all"><X size={24}/></button>
              </div>
              {reopenSuccess ? (
                <div className="py-8 flex flex-col items-center text-center">
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-6"><CheckCircle2 size={40} /></div>
                  <h3 className="text-lg font-black uppercase tracking-widest text-slate-800">Request Dispatched</h3>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-5 bg-orange-50/50 rounded-2xl border border-orange-100 flex items-center gap-4">
                    <History className="text-[#f36f21]" size={20} />
                    <span className="text-[0.7rem] font-bold text-slate-700 uppercase tracking-wide">Target: {validatedRow?.[6]}</span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest ml-1">Escalation Reason</label>
                    <textarea 
                      placeholder="Explain why this ticket needs further attention..." 
                      className="w-full px-5 py-5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-[#f36f21] font-bold text-[0.75rem] min-h-[140px] transition-all text-slate-700" 
                      value={reopenReason} 
                      onChange={e => setReopenReason(e.target.value)} 
                    />
                  </div>
                  <button onClick={handleReopenSubmit} disabled={!reopenReason.trim()} className="w-full py-5 bg-[#f36f21] text-white font-black rounded-2xl flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-[0.7rem] shadow-lg shadow-orange-500/20 disabled:opacity-50 hover:bg-[#e44d26] transition-all">Submit Request <Send size={16}/></button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal: Raise Ticket */}
        {isTicketModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[2000] flex items-center justify-center p-6 fade-in">
            <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl relative slide-up border border-slate-100">
              {isSubmittingTicket && <Loader />}
              <div className="flex justify-between items-start mb-8">
                <div>
                  <span className="text-[0.55rem] font-black text-[#f36f21] uppercase tracking-[0.3em]">Support Desk</span>
                  <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">New Support Ticket</h2>
                </div>
                <button onClick={() => setIsTicketModalOpen(false)} className="p-2 text-slate-300 hover:text-slate-800 transition-all"><X size={24}/></button>
              </div>
              {ticketSuccess ? (
                <div className="py-8 flex flex-col items-center text-center">
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-6"><CheckCircle2 size={40} /></div>
                  <h3 className="text-lg font-black uppercase tracking-widest text-slate-800">Ticket Launched</h3>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest ml-1">Inquiry Details</label>
                    <textarea 
                      placeholder="Please describe your technical query or operational issue..." 
                      className="w-full px-6 py-6 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-[#f36f21] font-bold text-[0.75rem] min-h-[160px] transition-all text-slate-700" 
                      value={ticketForm.issueQuery} 
                      onChange={e => setTicketForm({ issueQuery: e.target.value })} 
                    />
                  </div>
                  <button 
                    disabled={!ticketForm.issueQuery.trim()} 
                    onClick={handleRaiseTicket} 
                    className="w-full py-5 bg-[#f36f21] text-white font-black rounded-2xl flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-[0.7rem] shadow-lg shadow-orange-500/20 hover:bg-[#e44d26] transition-all disabled:opacity-50"
                  >
                    Open Ticket <Send size={16}/>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Drawer: Tracking */}
        <div className={`fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-[100] transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsDrawerOpen(false)} />
        <aside className={`fixed top-0 right-0 h-full w-full max-w-[480px] bg-[#f8fafc] shadow-2xl z-[200] flex flex-col transition-transform duration-500 transform border-l border-slate-100 ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          {selectedRow && (
            <>
              <div className="p-8 bg-white border-b border-slate-100 flex justify-between items-center">
                <div>
                  <span className="text-[0.55rem] font-black text-[#f36f21] uppercase tracking-[0.3em]">In-Depth Lifecycle</span>
                  <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mt-1">{selectedRow[6] || 'Tracking'}</h2>
                </div>
                <button onClick={() => setIsDrawerOpen(false)} className="p-2 text-slate-300 hover:text-slate-800 transition-all"><X size={24}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-5 custom-scrollbar">
                {STEPS.map((step, i) => {
                  const statusStr = (selectedRow[step.s] || '').trim().toLowerCase();
                  const actualVal = (selectedRow[step.a] || '').trim();
                  const isDone = statusStr.includes('done') || (actualVal !== '-' && actualVal !== '');
                  const currentInfo = getMilestoneStatus(selectedRow);
                  const isFocus = (currentInfo.idx === i);
                  return <MilestoneCard key={step.n} index={i} step={step} row={selectedRow} isFocus={isFocus} isDone={isDone} />;
                })}
              </div>
              <div className="p-8 bg-white border-t border-slate-100">
                <button onClick={() => setIsDrawerOpen(false)} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl uppercase tracking-[0.2em] text-[0.65rem]">Close Timeline</button>
              </div>
            </>
          )}
        </aside>

        {showLogoutConfirm && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-6 fade-in">
            <div className="bg-white rounded-[3rem] p-12 max-w-[400px] w-full shadow-2xl text-center border border-slate-100">
              <div className="w-20 h-20 bg-red-50 text-[#991b1b] rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-sm"><LogOut size={36} /></div>
              <h3 className="text-2xl font-black text-[#1e293b] uppercase mb-4 tracking-tight">End Session?</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-10 leading-relaxed">You will need to verify your identity again to re-access the portal.</p>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={logout} className="py-5 bg-[#991b1b] text-white font-black rounded-2xl uppercase tracking-widest text-[0.7rem] shadow-lg shadow-red-500/10 hover:bg-[#7f1d1d] transition-all">Confirm</button>
                <button onClick={() => setShowLogoutConfirm(false)} className="py-5 bg-slate-50 text-slate-500 font-black rounded-2xl uppercase tracking-widest text-[0.7rem] hover:bg-slate-100 transition-all">Go Back</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
