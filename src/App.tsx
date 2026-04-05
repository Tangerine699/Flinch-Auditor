import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Activity, 
  BarChart3, 
  Users, 
  Lock,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  LogIn,
  LogOut
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { format } from 'date-fns';
import { db, auth, collection, query, orderBy, onSnapshot, limit, onAuthStateChanged, User, doc, setDoc, serverTimestamp } from './firebase';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';

// Error Handling Spec for Firestore Operations
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // We don't throw here to avoid crashing the app, but we log it for the agent.
}

// Mock data for initial load
const MOCK_TRENDS = [
  { date: '2026-04-01', leaks: 12 },
  { date: '2026-04-02', leaks: 18 },
  { date: '2026-04-03', leaks: 8 },
  { date: '2026-04-04', leaks: 24 },
  { date: '2026-04-05', leaks: 15 },
];

const VIOLATION_CATEGORIES = [
  { name: 'PII (Email/SSN)', value: 45, color: '#ef4444' },
  { name: 'Credentials', value: 30, color: '#f59e0b' },
  { name: 'Proprietary Code', value: 25, color: '#3b82f6' },
];

export default function App() {
  const [violations, setViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');

  // Real-time stats
  const [stats, setStats] = useState({
    leaksPrevented: 0,
    criticalViolations: 0,
    activeUsers: 0,
    trends: MOCK_TRENDS,
    categories: VIOLATION_CATEGORIES
  });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Ensure user document exists for isAdmin check
        try {
          await setDoc(doc(db, 'users', currentUser.uid), {
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            lastLogin: serverTimestamp(),
            // Default role is 'user' unless they are the bootstrap admin
            role: currentUser.email === 'aniketsinghgl2004@gmail.com' ? 'admin' : 'user'
          }, { merge: true });
        } catch (error) {
          console.error('Error updating user profile:', error);
        }
      }
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'violations'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setViolations(data);
      
      // Calculate stats in real-time
      const critical = data.filter(v => v.severity === 'CRITICAL').length;
      const uniqueUsers = new Set(data.map(v => v.userHash)).size;
      
      // Group by category for pie chart
      const catCounts: Record<string, number> = {
        'PII (Email/SSN)': 0,
        'Credentials': 0,
        'Proprietary Code': 0
      };
      
      data.forEach(v => {
        if (v.violationType === 'EMAIL' || v.violationType === 'SSN') catCounts['PII (Email/SSN)']++;
        else if (v.violationType === 'AWS_KEY' || v.violationType === 'BEARER_TOKEN') catCounts['Credentials']++;
        else if (v.violationType === 'PROPRIETARY_CODE') catCounts['Proprietary Code']++;
      });

      setStats(prev => ({
        ...prev,
        leaksPrevented: data.length,
        criticalViolations: critical,
        activeUsers: uniqueUsers,
        categories: [
          { name: 'PII (Email/SSN)', value: catCounts['PII (Email/SSN)'] || 1, color: '#ef4444' },
          { name: 'Credentials', value: catCounts['Credentials'] || 1, color: '#f59e0b' },
          { name: 'Proprietary Code', value: catCounts['Proprietary Code'] || 1, color: '#3b82f6' },
        ]
      }));

      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'violations');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, authReady]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setViolations([]);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleExportCSV = () => {
    if (violations.length === 0) return;
    
    const headers = ['Timestamp', 'User Hash', 'Platform', 'Type', 'Severity', 'Overridden', 'Reason'];
    const rows = violations.map(v => [
      v.timestamp?.toDate ? v.timestamp.toDate().toISOString() : '',
      v.userHash,
      v.platform,
      v.violationType,
      v.severity,
      v.isOverridden ? 'Yes' : 'No',
      v.overrideReason || ''
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `flinch_audit_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 border border-slate-200 text-center">
          <div className="bg-red-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Flinch Auditor</h1>
          <p className="text-slate-500 mb-8">Secure CISO Dashboard. Please sign in to access the audit logs.</p>
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white py-4 rounded-xl font-semibold hover:bg-slate-800 transition-all active:scale-95"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900 text-white p-6 hidden lg:block">
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-red-500 p-2 rounded-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Flinch Auditor</h1>
        </div>

        <nav className="space-y-2">
          <NavItem 
            icon={<Activity className="w-5 h-5" />} 
            label="Overview" 
            active={activeTab === 'Overview'} 
            onClick={() => setActiveTab('Overview')}
          />
          <NavItem 
            icon={<BarChart3 className="w-5 h-5" />} 
            label="Analytics" 
            active={activeTab === 'Analytics'} 
            onClick={() => setActiveTab('Analytics')}
          />
          <NavItem 
            icon={<Users className="w-5 h-5" />} 
            label="Users" 
            active={activeTab === 'Users'} 
            onClick={() => setActiveTab('Users')}
          />
          <NavItem 
            icon={<Lock className="w-5 h-5" />} 
            label="Policies" 
            active={activeTab === 'Policies'} 
            onClick={() => setActiveTab('Policies')}
          />
        </nav>

        <div className="absolute bottom-6 left-6 right-6 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl">
            <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-slate-700" />
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate">{user.displayName}</p>
              <button onClick={handleLogout} className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1">
                <LogOut className="w-3 h-3" /> Sign Out
              </button>
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-2">SOC 2 Compliance Status</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium">Fully Compliant</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold">CISO {activeTab}</h2>
            <p className="text-slate-500">
              {activeTab === 'Overview' ? 'Real-time data exfiltration monitoring' : 
               activeTab === 'Analytics' ? 'Deep dive into security trends' :
               activeTab === 'Users' ? 'User behavior and risk profiles' :
               'Enterprise security policy management'}
            </p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={handleExportCSV}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Export Audit Log
            </button>
            <button className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
              Configure Policies
            </button>
          </div>
        </header>

        {activeTab === 'Overview' && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {loading ? (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              ) : (
                <>
                  <KPICard 
                    title="Leaks Prevented" 
                    value={stats.leaksPrevented.toLocaleString()} 
                    trend="+12% from last month" 
                    icon={<CheckCircle className="w-6 h-6 text-green-500" />} 
                  />
                  <KPICard 
                    title="Critical Violations" 
                    value={stats.criticalViolations.toLocaleString()} 
                    trend="-5% from last month" 
                    icon={<AlertTriangle className="w-6 h-6 text-red-500" />} 
                  />
                  <KPICard 
                    title="Active Users Monitored" 
                    value={stats.activeUsers.toLocaleString()} 
                    trend="+24 new this week" 
                    icon={<Users className="w-6 h-6 text-blue-500" />} 
                  />
                </>
              )}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-semibold mb-6">Leak Trends (7 Days)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.trends}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Line type="monotone" dataKey="leaks" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-semibold mb-6">Violation Categories</h3>
                <div className="h-64 flex items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.categories}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats.categories.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {stats.categories.map((cat) => (
                      <div key={cat.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-sm text-slate-600">{cat.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Violations Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-semibold">Recent Audit Trail</h3>
                <button className="text-sm text-blue-600 font-medium flex items-center gap-1 hover:underline">
                  View All <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-medium">Timestamp</th>
                      <th className="px-6 py-4 font-medium">User Hash</th>
                      <th className="px-6 py-4 font-medium">Platform</th>
                      <th className="px-6 py-4 font-medium">Type</th>
                      <th className="px-6 py-4 font-medium">Severity</th>
                      <th className="px-6 py-4 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {violations.length > 0 ? violations.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {v.timestamp?.toDate ? format(v.timestamp.toDate(), 'MMM d, HH:mm:ss') : 'Just now'}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-slate-500">
                          {v.userHash?.substring(0, 8)}...
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className="bg-slate-100 px-2 py-1 rounded text-xs font-medium">
                            {v.platform}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium">
                          {v.violationType}
                        </td>
                        <td className="px-6 py-4">
                          <SeverityBadge severity={v.severity} />
                        </td>
                        <td className="px-6 py-4">
                          <button className="text-slate-400 hover:text-slate-600">
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                          {loading ? 'Loading audit trail...' : 'No violations detected in the last 24 hours.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab !== 'Overview' && (
          <div className="bg-white rounded-3xl p-20 border border-dashed border-slate-300 text-center">
            <div className="bg-slate-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Lock className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">{activeTab} Module</h3>
            <p className="text-slate-500 max-w-sm mx-auto">
              The {activeTab} module is currently being provisioned for your organization. 
              Check back soon for deep-dive insights.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        active ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-pulse">
      <div className="w-10 h-10 bg-slate-100 rounded-lg mb-4" />
      <div className="h-4 bg-slate-100 rounded w-24 mb-2" />
      <div className="h-8 bg-slate-100 rounded w-16" />
    </div>
  );
}

function KPICard({ title, value, trend, icon }: { title: string, value: string, trend: string, icon: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-slate-50 rounded-lg">
          {icon}
        </div>
        <span className={`text-xs font-medium ${trend.includes('+') ? 'text-green-600' : 'text-red-600'}`}>
          {trend}
        </span>
      </div>
      <h4 className="text-slate-500 text-sm font-medium mb-1">{title}</h4>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors = {
    LOW: 'bg-blue-100 text-blue-700',
    HIGH: 'bg-orange-100 text-orange-700',
    CRITICAL: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors[severity as keyof typeof colors] || 'bg-slate-100'}`}>
      {severity}
    </span>
  );
}
