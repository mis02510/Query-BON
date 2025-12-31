
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, RawRow, MilestoneInfo } from './types';
import { 
  CSV_QUERY_URL, 
  CSV_API_URL, 
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
  CheckCircle2,
  Clock,
  Key,
  User as UserIcon,
  Search,
  ArrowRight,
  WifiOff,
  Filter
} from 'lucide-react';

// --- Shared UI Components ---

const Loader: React.FC = () => (
  <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-[1000] flex flex-col items-center justify-center fade-in">
    <div className="w-12 h-12 border-4 border-slate-100 border-t-sky-500 rounded-full animate-spin mb-4"></div>
    <p className="text-slate-500 font-extrabold text-[0.6rem] uppercase tracking-[0.2em]">Syncing Query Stream</p>
  </div>
);

const SyncError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 text-center bg-slate-50/50">
    <div className="w-16 h-16 md:w-20 md:h-20 bg-red-50 text-red-500 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center mb-6 md:mb-8 shadow-xl shadow-red-500/10">
      <WifiOff size={32} className="md:w-10 md:h-10" strokeWidth={2.5} />
    </div>
    <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-3 tracking-tight">Sync Stream Disconnected</h2>
    <p className="max-w-md text-slate-500 font-medium text-xs md:text-sm leading-relaxed mb-8 md:mb-10">
      The system encountered a <span className="font-bold text-red-600">NOT_FOUND</span> error. 
      Please ensure the Google Sheet is <span className="underline decoration-2 underline-offset-4 decoration-red-200">Published to the Web</span> and the Sheet ID is correct.
    </p>
    <button 
      onClick={onRetry}
      className="w-full md:w-auto px-8 py-4 bg-slate-900 text-white font-black rounded-2xl flex items-center justify-center gap-3 hover:bg-black transition-all active:scale-95 shadow-xl shadow-slate-900/10 uppercase tracking-widest text-xs"
    >
      <RefreshCcw size={18} strokeWidth={2.5} />
      Attempt Reconnection
    </button>
  </div>
);

const MilestoneCard: React.FC<{ 
  index: number,
  step: any, 
  row: RawRow, 
  isFocus: boolean, 
  isDone: boolean 
}> = ({ index, step, row, isFocus, isDone }) => {
  const planStr = row[step.p] || '-';
  const actualStr = row[step.a] || '-';
  const delayVal = (row[step.d] || '').trim();
  
  let delayIndicator = null;
  if (delayVal && delayVal !== '-' && delayVal !== '0' && delayVal !== '0:00:00') {
    const isLate = !delayVal.startsWith('-');
    delayIndicator = (
      <div className={`mt-2 flex items-center gap-1.5 text-[0.6rem] font-black px-2 py-1 rounded-md tracking-tight ${
        isLate ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
      }`}>
        {isLate ? <AlertCircle size={10} /> : <CheckCircle2 size={10} />}
        {isLate ? 'DELAY' : 'AHEAD'}: {delayVal.replace('-', '')}
      </div>
    );
  }

  return (
    <div className={`group relative bg-white rounded-2xl p-5 md:p-6 border transition-all duration-300 ${
      isFocus 
        ? 'border-sky-200 shadow-[0_10px_30px_rgba(14,165,233,0.1)] ring-2 ring-sky-50' 
        : 'border-slate-100 shadow-sm hover:border-slate-200'
    }`}>
      {isFocus && <div className="absolute top-0 left-0 h-full w-1.5 bg-sky-500 rounded-l-2xl" />}
      
      <div className="flex justify-between items-start mb-4 md:mb-5">
        <div className="flex-1 pr-2">
          <h5 className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest mb-1">
            Step {index + 1}
          </h5>
          <h4 className={`text-[0.7rem] md:text-[0.75rem] font-black uppercase tracking-tight leading-tight ${isFocus ? 'text-sky-600' : 'text-slate-700'}`}>
            {step.n}
          </h4>
          {delayIndicator}
        </div>
        <div className={`text-[0.55rem] md:text-[0.6rem] font-black px-2 md:px-3 py-1 md:py-1.5 rounded-full uppercase tracking-widest whitespace-nowrap ${
          isDone ? 'bg-emerald-50 text-emerald-600' : 
          (isFocus ? 'bg-sky-50 text-sky-600 animate-pulse' : 'bg-slate-50 text-slate-400')
        }`}>
          {isDone ? 'Completed' : (isFocus ? 'In Progress' : 'Idle')}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 md:gap-6 pt-4 border-t border-slate-50">
        <div className="space-y-1">
          <p className="text-[0.55rem] font-bold text-slate-400 uppercase tracking-widest">Planned Delivery</p>
          <p className="text-[0.75rem] md:text-[0.8rem] font-bold text-slate-700 mono-font truncate">{planStr}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[0.55rem] font-bold text-slate-400 uppercase tracking-widest">Actual Completion</p>
          <p className="text-[0.75rem] md:text-[0.8rem] font-bold text-slate-700 mono-font truncate">{actualStr}</p>
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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientFilter, setSelectedClientFilter] = useState('all');

  // --- Core Logic ---

  const checkSession = useCallback(() => {
    const stored = localStorage.getItem('qc_user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        setUser(u);
      } catch (e) {
        localStorage.removeItem('qc_user');
      }
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const getMilestoneStatus = useCallback((row: RawRow): MilestoneInfo => {
    const isStepDone = (idx: number) => {
      const s = STEPS[idx];
      const statusText = (row[s.s] || '').toLowerCase();
      const actualVal = (row[s.a] || '').trim();
      return statusText.includes('done') || statusText.includes('completed') || (actualVal !== '' && actualVal !== '-');
    };

    if (isStepDone(4)) return { n: 'Workflow Finalized', d: true, idx: 5 };
    for (let i = 0; i < STEPS.length; i++) {
      if (!isStepDone(i)) return { n: STEPS[i].n, d: false, idx: i };
    }
    return { n: 'Archived', d: true, idx: 5 };
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
    } catch (e) {
      console.error("Data Sync Error:", e);
      setSyncError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData(user);
  }, [user, fetchData]);

  const handleLogin = async () => {
    if (!loginForm.name || !loginForm.key) return;
    setIsLoading(true);
    try {
      const users = await fetchCSV(CSV_API_URL(Date.now()));
      const found = users.slice(1).find(u => 
        u[0].toLowerCase() === loginForm.name.toLowerCase() && u[1] === loginForm.key
      );
      if (found) {
        const u: User = { 
          name: loginForm.name, 
          isAdmin: loginForm.name.toUpperCase() === 'ADMIN' 
        };
        setUser(u);
        localStorage.setItem('qc_user', JSON.stringify(u));
        setLoginError(false);
      } else {
        setLoginError(true);
      }
    } catch (e) {
      console.error("Login System Error:", e);
      setLoginError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('qc_user');
    setUser(null);
    setData([]);
    setLoginForm({ name: '', key: '' }); 
    setShowLogoutConfirm(false);
    setSelectedClientFilter('all');
  };

  const uniqueClients = useMemo(() => {
    const clients = new Set<string>();
    data.forEach(row => {
      const name = (row[2] || '').trim();
      if (name) clients.add(name);
    });
    return Array.from(clients).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filteredData = useMemo(() => {
    let result = data;
    
    // Client Dropdown Filter
    if (selectedClientFilter !== 'all') {
      result = result.filter(row => (row[2] || '').trim() === selectedClientFilter);
    }

    // Search Query Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(row => 
        row.some(cell => cell.toLowerCase().includes(q))
      );
    }

    return result;
  }, [data, searchQuery, selectedClientFilter]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredData.slice(start, start + ROWS_PER_PAGE);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE) || 1;

  // --- View Templates ---

  if (!user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 p-4 md:p-6">
        <div className="w-full max-w-md bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.1)] p-6 md:p-10 border border-slate-200/50 relative overflow-hidden slide-up">
          {isLoading && <Loader />}
          <div className="text-center mb-8 md:mb-10">
            <div className="inline-flex p-3 md:p-4 bg-sky-50 text-sky-500 rounded-2xl md:rounded-3xl mb-4 md:mb-6">
              <LayoutDashboard size={32} className="md:w-10 md:h-10" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight mb-2">Query Command</h1>
            <p className="text-slate-400 text-[0.65rem] md:text-sm font-semibold tracking-wide uppercase">Elite Client Interface</p>
          </div>
          
          <div className="space-y-4">
            <div className="relative group">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-sky-500 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Identity Reference"
                className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 transition-all font-bold text-sm text-slate-700 placeholder:text-slate-300"
                value={loginForm.name}
                onChange={e => setLoginForm(prev => ({ ...prev, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <div className="relative group">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-sky-500 transition-colors" size={18} />
              <input
                type="password"
                placeholder="Security Credential"
                className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 transition-all font-bold text-sm text-slate-700 placeholder:text-slate-300"
                value={loginForm.key}
                onChange={e => setLoginForm(prev => ({ ...prev, key: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <button
              onClick={handleLogin}
              className="w-full py-4 md:py-5 bg-slate-900 hover:bg-black text-white font-black rounded-2xl shadow-xl transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3 text-sm"
            >
              AUTHENTICATE ACCESS
              <ArrowRight size={20} />
            </button>
            {loginError && (
              <div className="p-3 md:p-4 bg-red-50 rounded-xl flex items-center gap-3 text-red-600 animate-pulse">
                <AlertCircle size={18} />
                <span className="text-[0.6rem] md:text-[0.7rem] font-black uppercase tracking-widest">Authentication Denied</span>
              </div>
            )}
          </div>
          
          <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-slate-50 text-center">
            <p className="text-[0.55rem] md:text-[0.6rem] font-black text-slate-300 uppercase tracking-[0.3em]">Authorized Personnel Only</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col p-2 md:p-4 lg:p-8 bg-slate-100 overflow-hidden font-main">
      <div className="bg-white rounded-3xl md:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] flex flex-col h-full border border-slate-200 overflow-hidden relative slide-up">
        {isLoading && <Loader />}
        
        {/* Header Section */}
        <header className="px-5 md:px-8 py-4 md:py-6 border-b border-slate-50 flex flex-wrap justify-between items-center gap-4 bg-white/90 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-3 md:gap-5">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-sky-500 text-white rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg shadow-sky-500/30 shrink-0">
              <LayoutDashboard size={20} className="md:w-6 md:h-6" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm md:text-xl font-black text-slate-800 tracking-tight leading-none uppercase truncate">Query Hub</h1>
              <div className="mt-1 md:mt-1.5 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0"></div>
                <span className="text-[0.5rem] md:text-[0.6rem] font-black text-slate-400 uppercase tracking-widest truncate">
                  {user.isAdmin ? 'ADMIN' : user.name}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 ml-auto sm:ml-0">
            {/* Admin Client Dropdown */}
            {user.isAdmin && (
              <div className="relative group hidden lg:block">
                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-sky-500 transition-colors" size={16} />
                <select 
                  value={selectedClientFilter}
                  onChange={e => {
                    setSelectedClientFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-11 pr-10 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[0.7rem] font-black text-slate-700 focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 w-[180px] transition-all cursor-pointer appearance-none uppercase tracking-widest"
                >
                  <option value="all">All Clients</option>
                  {uniqueClients.map(client => (
                    <option key={client} value={client}>{client}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                  <ChevronRight size={14} className="rotate-90" />
                </div>
              </div>
            )}

            <div className="relative group hidden sm:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-sky-500 transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Filter queries..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 w-[160px] md:w-[200px] transition-all"
              />
            </div>
            
            <button 
              onClick={() => fetchData(user)}
              className="p-2.5 md:p-3 bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 rounded-xl transition-all active:scale-90"
              title="Refresh"
            >
              <RefreshCcw size={16} className={`md:w-[18px] md:h-[18px] ${isLoading ? 'animate-spin' : ''}`} strokeWidth={2.5} />
            </button>
            
            <button 
              onClick={() => setShowLogoutConfirm(true)}
              className="px-4 md:px-5 py-2.5 md:py-3 bg-slate-900 text-white rounded-xl text-[0.6rem] md:text-[0.65rem] font-black flex items-center gap-2 md:gap-3 transition-all hover:bg-black active:scale-95 shadow-lg shadow-slate-900/10"
            >
              <LogOut size={14} className="md:w-4 md:h-4" strokeWidth={2.5} />
              <span className="hidden lg:inline uppercase tracking-widest">LOG OUT</span>
            </button>
          </div>
        </header>

        {/* Dynamic Table Section */}
        <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50/20 flex flex-col">
          {syncError ? (
            <SyncError onRetry={() => fetchData(user)} />
          ) : (
            <div className="min-w-full inline-block align-middle">
              <table className="w-full text-left border-collapse min-w-[700px] md:min-w-[800px]">
                <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-20 border-b border-slate-100">
                  <tr>
                    {(user.isAdmin ? ADMIN_COLS : USER_COLS).map(col => (
                      <th key={col.l} className="px-4 md:px-8 py-4 md:py-5 text-[0.55rem] md:text-[0.6rem] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">
                        {col.l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-8 py-20 md:py-32 text-center">
                        <div className="flex flex-col items-center opacity-30">
                          <Search size={40} className="md:w-12 md:h-12 mb-4" />
                          <p className="text-slate-500 font-black text-[0.6rem] md:text-xs tracking-widest uppercase italic">No Matching Queries</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((row, ridx) => {
                      const info = getMilestoneStatus(row);
                      const cols = user.isAdmin ? ADMIN_COLS : USER_COLS;
                      return (
                        <tr key={ridx} className="group hover:bg-white transition-all duration-200">
                          {cols.map((col, cidx) => {
                            if (col.i === -1) {
                              return (
                                <td key={cidx} className="px-4 md:px-8 py-4 md:py-5">
                                  <button 
                                    onClick={() => {
                                      setSelectedRow(row);
                                      setIsDrawerOpen(true);
                                    }}
                                    className="px-4 md:px-6 py-2 bg-white text-slate-800 border-2 border-slate-100 text-[0.55rem] md:text-[0.6rem] font-black rounded-lg md:rounded-xl hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all active:scale-95 uppercase tracking-[0.15em] shadow-sm"
                                  >
                                    Tracking
                                  </button>
                                </td>
                              );
                            }
                            if (col.i === -2) {
                              return (
                                <td key={cidx} className="px-4 md:px-8 py-4 md:py-5">
                                  <div className="text-[0.7rem] md:text-[0.75rem] font-black text-slate-700 tracking-tight">Step {info.idx < 5 ? info.idx + 1 : 5}: {info.n}</div>
                                  <div className={`text-[0.5rem] md:text-[0.55rem] font-black uppercase tracking-widest mt-0.5 ${info.d ? 'text-emerald-500' : 'text-amber-500'}`}>
                                    {info.d ? 'Completed' : 'Processing'}
                                  </div>
                                </td>
                              );
                            }
                            if (col.i === 6) {
                              return (
                                <td key={cidx} className="px-4 md:px-8 py-4 md:py-5 mono-font text-sky-600 font-bold text-[0.75rem] md:text-[0.8rem]">
                                  {row[col.i] || '-'}
                                </td>
                              );
                            }
                            if (col.i === 3) {
                              return (
                                <td key={cidx} className="px-4 md:px-8 py-4 md:py-5 group-hover:text-slate-900">
                                  <div className="text-[0.75rem] md:text-[0.8rem] text-slate-600 font-bold whitespace-normal break-words leading-relaxed max-w-[200px] md:max-w-[320px] uppercase tracking-tight">
                                    {row[col.i] || '-'}
                                  </div>
                                </td>
                              );
                            }
                            return (
                              <td key={cidx} className="px-4 md:px-8 py-4 md:py-5 text-[0.75rem] md:text-[0.8rem] text-slate-600 font-semibold whitespace-nowrap overflow-hidden max-w-[150px] md:max-w-[280px] truncate group-hover:text-slate-900">
                                {row[col.i] || '-'}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <footer className="px-6 md:px-12 py-6 border-t border-slate-50 flex justify-between items-center bg-white shrink-0 relative">
          <button 
            disabled={currentPage <= 1 || syncError}
            onClick={() => setCurrentPage(prev => prev - 1)}
            className="flex items-center gap-3 px-5 py-3 bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-20 disabled:cursor-not-allowed text-[0.6rem] md:text-[0.65rem] font-black uppercase tracking-[0.2em] rounded-2xl transition-all active:scale-95"
          >
            <ChevronLeft size={16} strokeWidth={3} />
            <span>PREVIOUS</span>
          </button>
          
          <div className="flex flex-col items-center">
            <span className="text-[0.8rem] md:text-[0.9rem] font-bold text-slate-800 tracking-[0.2em] uppercase">
              {currentPage} / {totalPages}
            </span>
            <div className="text-[0.5rem] md:text-[0.55rem] font-black text-slate-300 uppercase tracking-[0.3em] mt-0.5">Archive</div>
          </div>

          <button 
            disabled={currentPage >= totalPages || syncError}
            onClick={() => setCurrentPage(prev => prev + 1)}
            className="flex items-center gap-3 px-5 py-3 bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-20 disabled:cursor-not-allowed text-[0.6rem] md:text-[0.65rem] font-black uppercase tracking-[0.2em] rounded-2xl transition-all active:scale-95"
          >
            <span>NEXT</span>
            <ChevronRight size={16} strokeWidth={3} />
          </button>
        </footer>

        {/* Slide-out Milestone Tracking Drawer */}
        <div 
          className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] transition-opacity duration-500 ${isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setIsDrawerOpen(false)}
        />
        <aside className={`fixed top-0 right-0 h-full w-full md:max-w-[500px] bg-slate-50 shadow-[-30px_0_60px_rgba(0,0,0,0.1)] z-[200] flex flex-col transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) transform ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          {selectedRow && (
            <>
              <div className="p-6 md:p-10 bg-white border-b border-slate-100 shrink-0">
                <div className="flex justify-between items-start mb-6 md:mb-10">
                  <div className="space-y-1.5 md:space-y-2 min-w-0">
                    <span className="text-[0.55rem] md:text-[0.6rem] font-black text-sky-500 uppercase tracking-[0.3em] md:tracking-[0.4em] block truncate">Status Monitor</span>
                    <h2 className="mono-font text-xl md:text-3xl font-black text-slate-800 leading-none break-all">
                      {selectedRow[6] || 'UNIDENTIFIED'}
                    </h2>
                  </div>
                  <button 
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-2 md:p-3 text-slate-300 hover:text-slate-900 hover:bg-slate-100 rounded-xl md:rounded-2xl transition-all active:scale-90 shrink-0"
                  >
                    <X size={24} className="md:w-7 md:h-7" strokeWidth={2.5} />
                  </button>
                </div>
                <div className="p-4 md:p-6 bg-slate-50 rounded-2xl md:rounded-[1.5rem] border border-slate-100 shadow-inner overflow-hidden">
                  <p className="text-[0.5rem] md:text-[0.55rem] font-black text-slate-400 uppercase tracking-widest mb-2 md:mb-3">Query Case Details</p>
                  <p className="text-[0.75rem] md:text-[0.85rem] font-bold text-slate-700 leading-relaxed italic line-clamp-3 md:line-clamp-none">
                    "{selectedRow[3] || 'No description provided.'}"
                  </p>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-4 md:space-y-6 custom-scrollbar text-slate-800">
                {STEPS.map((step, i) => {
                  const statusStr = (selectedRow[step.s] || '').trim().toLowerCase();
                  const actualVal = (selectedRow[step.a] || '').trim();
                  const isDone = statusStr.includes('done') || (actualVal !== '-' && actualVal !== '');
                  const currentInfo = getMilestoneStatus(selectedRow);
                  const isFocus = (currentInfo.idx === i);

                  return (
                    <MilestoneCard 
                      key={step.n} 
                      index={i}
                      step={step} 
                      row={selectedRow} 
                      isFocus={isFocus} 
                      isDone={isDone} 
                    />
                  );
                })}
                <div className="h-10"></div>
              </div>
            </>
          )}
        </aside>

        {/* Confirmation Overlay */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[2000] flex items-center justify-center p-4 md:p-6 fade-in">
            <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-8 md:p-10 max-w-sm w-full shadow-2xl border border-slate-100 slide-up">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-red-50 text-red-500 rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-6 md:mb-8 shadow-inner">
                <LogOut size={32} className="md:w-9 md:h-9" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl md:text-2xl font-black text-slate-800 text-center mb-2 md:mb-3 tracking-tight">End Session?</h3>
              <p className="text-[0.75rem] md:text-[0.85rem] text-slate-400 font-bold text-center mb-8 md:mb-10 leading-relaxed uppercase tracking-wider">
                This will terminate your connection to the elite query system.
              </p>
              <div className="flex gap-3 md:gap-4">
                <button 
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-3.5 md:py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black rounded-xl md:rounded-2xl transition-all uppercase tracking-widest text-[0.6rem] md:text-[0.65rem]"
                >
                  Stay
                </button>
                <button 
                  onClick={logout}
                  className="flex-1 py-3.5 md:py-4 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl md:rounded-2xl transition-all shadow-lg shadow-red-500/30 uppercase tracking-widest text-[0.6rem] md:text-[0.65rem]"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
