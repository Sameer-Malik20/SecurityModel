'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { 
  ShieldAlert, 
  ShieldCheck, 
  ChevronDown, 
  ChevronUp, 
  Code, 
  Zap, 
  Copy, 
  Check,
  AlertCircle,
  FileCode,
  ArrowRight,
  ChevronLeft,
  LayoutGrid,
  Bug,
  Activity,
  ArrowUpRight,
  Terminal,
  Cpu,
  Loader2,
  ScrollText,
  ShieldQuestion,
  Download
} from 'lucide-react';

export default function ScanDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [scan, setScan] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<Record<number, any>>({});
  const [analyzing, setAnalyzing] = useState<Record<number, boolean>>({});
  const [reportViewMode, setReportViewMode] = useState<'ai' | 'semgrep' | 'codeql' | 'zap'>('ai');
  const [activeTab, setActiveTab] = useState<'all' | 'code' | 'runtime'>('all');

  const filteredIssues = report?.issues?.filter((issue: any) => {
    if (activeTab === 'all') return true;
    return issue.source === activeTab;
  });

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    const fetchScan = async () => {
      try {
        const res = await api.get(`/scans/${id}`);
        setScan(res.data);
        
        if (res.data.status === 'completed' || res.data.status === 'failed') {
          try {
            setReport(JSON.parse(res.data.report_json));
          } catch (e) {
            console.error("Failed to parse report data", e);
          }
          setLoading(false);
          if (pollInterval) clearInterval(pollInterval);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    fetchScan();
    pollInterval = setInterval(fetchScan, 3000);

    return () => clearInterval(pollInterval);
  }, [id]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [scan?.logs]);

  const runAiAnalysis = async (index: number) => {
    setAnalyzing(prev => ({ ...prev, [index]: true }));
    try {
      const res = await api.post(`/scans/${id}/analyze?issue_index=${index}`);
      if (res.data.error) {
        alert(res.data.error);
      } else {
        setAiAnalysis(prev => ({ ...prev, [index]: res.data }));
      }
    } catch (err) {
      alert('AI analysis failed');
    } finally {
      setAnalyzing(prev => ({ ...prev, [index]: false }));
    }
  };

  const getSeverityStyles = (sev: string) => {
    switch (sev?.toUpperCase()) {
      case 'HIGH': 
        return {
          bg: 'bg-red-500/10',
          text: 'text-red-500',
          border: 'border-red-500/20',
          dot: 'bg-red-500'
        };
      case 'MEDIUM': 
        return {
          bg: 'bg-orange-500/10',
          text: 'text-orange-500',
          border: 'border-orange-500/20',
          dot: 'bg-orange-500'
        };
      case 'LOW': 
        return {
          bg: 'bg-yellow-500/10',
          text: 'text-yellow-500',
          border: 'border-yellow-500/20',
          dot: 'bg-yellow-500'
        };
      default: 
        return {
          bg: 'bg-blue-500/10',
          text: 'text-blue-500',
          border: 'border-blue-500/20',
          dot: 'bg-blue-500'
        };
    }
  };

  const getSeverityCounts = () => {
    if (!report?.issues) return { HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
    return report.issues.reduce((acc: any, issue: any) => {
      const sev = issue.severity?.toUpperCase();
      acc[sev] = (acc[sev] || 0) + 1;
      return acc;
    }, { HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 });
  };

  const calculateScore = () => {
    if (!report?.issues || report.issues.length === 0) return 100;
    const counts = getSeverityCounts();
    // Weighted scoring: High=20, Medium=10, Low=5
    const totalDeduction = (counts.HIGH * 20) + (counts.MEDIUM * 10) + (counts.LOW * 5);
    return Math.max(0, 100 - totalDeduction);
  };

  const getConfidenceLevel = () => {
    if (!report?.issues) return 0;
    const confirmedByRuntime = report.issues.filter((i: any) => i.evidence_level === 'runtime_confirmed').length;
    const total = report.issues.length;
    if (total === 0) return 98; // Very high confidence if nothing found
    return Math.min(99, 85 + (confirmedByRuntime / total * 15)); // Basis 85% + boost if confirmed
  };

  const handleDownload = (type: 'ai' | 'semgrep' | 'codeql' | 'zap' = 'ai') => {
    let dataToDownload: any = null;
    let fileName = "";

    if (type === 'ai') {
        if (!report) return;
        dataToDownload = report;
        fileName = `ai-enhanced-report-${id}.json`;
    } else {
        dataToDownload = scan.raw_reports[type];
        fileName = `raw-${type}-report-${id}.${type === 'codeql' ? 'sarif' : 'json'}`;
    }

    const blob = new Blob([JSON.stringify(dataToDownload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen text-gray-900 dark:text-white bg-white dark:bg-black transition-colors">
      <div className="flex flex-col items-center">
        <Loader2 className="animate-spin text-blue-500 mb-6" size={64} />
        <h2 className="text-2xl font-bold tracking-widest uppercase opacity-80">Syncing Engine...</h2>
      </div>
    </div>
  );

  // If status is pending, show the loading/log tracker
  if (scan?.status === 'pending') {
    return (
      <div className="min-h-screen text-gray-900 dark:text-white pb-32 bg-gray-50 dark:bg-black transition-colors">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 mt-20">
          <div className="bg-white dark:bg-zinc-900 p-10 rounded-[2.5rem] border border-gray-200 dark:border-blue-500/20 shadow-2xl shadow-blue-500/5">
            <div className="flex flex-col items-center text-center mb-10">
               <div className="relative mb-8">
                  <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 animate-pulse" />
                  <Activity className="text-blue-500 animate-bounce relative" size={64} />
               </div>
               <h1 className="text-4xl font-black mb-4 tracking-tighter">SECURING YOUR ASSETS</h1>
               <p className="text-gray-400 text-lg max-w-md mx-auto">
                 We are currently running a deep-dive security audit on your repository. This includes static analysis, dynamic testing, and vulnerability synthesis.
               </p>
            </div>

            {/* Log Terminal */}
            <div className="bg-[#050505] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
               <div className="bg-white/5 px-6 py-3 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                     <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                     <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                     <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                  </div>
                  <span className="text-[10px] font-black tracking-[0.2em] text-white/30 uppercase flex items-center space-x-2">
                     <Terminal size={12} />
                     <span>Live Execution Logs</span>
                  </span>
               </div>
               <div className="p-8 h-80 overflow-y-auto font-mono text-sm leading-relaxed scrollbar-thin scrollbar-thumb-white/10">
                  {scan.logs?.map((log: string, i: number) => (
                    <div key={i} className="mb-2 flex items-start space-x-4 group">
                      <span className="text-white/20 select-none w-4">{i + 1}</span>
                      <span className={`${log.startsWith('ERROR') ? 'text-red-400' : log.startsWith('CRITICAL') ? 'text-red-600 font-bold' : 'text-blue-400/80'} group-hover:text-white transition-colors`}>
                        {log}
                      </span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                  <div className="flex items-center space-x-2 text-green-500/60 animate-pulse mt-4">
                     <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                     <span className="text-[10px] font-bold uppercase tracking-widest">Waiting for next engine cycle...</span>
                  </div>
               </div>
            </div>

            <div className="mt-12 grid grid-cols-3 gap-6">
               {[
                 { label: 'Cloning', status: scan.logs?.some((l: any) => l.includes('Cloning')) ? 'DONE' : 'WAITING' },
                 { label: 'Static Analysis', status: scan.logs?.some((l: any) => l.includes('Static')) ? 'ACTIVE' : 'WAITING' },
                 { label: 'Dynamic Analysis', status: scan.logs?.some((l: any) => l.includes('Dynamic')) ? 'QUEUED' : 'WAITING' },
               ].map((step, i) => (
                 <div key={i} className="flex flex-col items-center">
                    <div className={`w-1 h-8 mb-2 rounded-full ${step.status === 'DONE' ? 'bg-green-500' : step.status === 'ACTIVE' ? 'bg-blue-500 animate-pulse' : 'bg-white/10'}`} />
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">{step.label}</span>
                    <span className={`text-[9px] font-bold ${step.status === 'DONE' ? 'text-green-500' : step.status === 'ACTIVE' ? 'text-blue-500' : 'text-white/20'}`}>{step.status}</span>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If failed
  if (scan?.status === 'failed') {
     return (
        <div className="min-h-screen text-gray-900 dark:text-white bg-gray-50 dark:bg-black transition-colors">
          <Navbar />
          <div className="max-w-xl mx-auto px-4 mt-32 text-center">
             <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-500/20">
                <ShieldQuestion className="text-red-500" size={40} />
             </div>
             <h1 className="text-3xl font-black mb-4">SCAN ENGAGEMENT FAILED</h1>
             <p className="text-gray-400 mb-10">
                Our security engine encountered a critical error during execution. This usually happens due to unreachable repositories or invalid credentials.
             </p>
             <div className="bg-red-500/5 p-6 rounded-2xl border border-red-500/10 text-left font-mono text-xs text-red-400 mb-8">
                {scan.logs?.[scan.logs.length - 1]}
             </div>
             <button 
                onClick={() => router.push('/dashboard')}
                className="bg-white text-black px-8 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
             >
                Return to Dashboard
             </button>
          </div>
        </div>
     );
  }

  const counts = getSeverityCounts();

  return (
    <div className="min-h-screen text-gray-900 dark:text-white bg-gray-50 dark:bg-black transition-colors pb-32">
      <Navbar />
      
      {/* Header & Breadcrumbs */}
      <div className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-white/5 pt-8 pb-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <span>/</span>
            <Link href={`/projects/${scan?.project_id}`} className="hover:text-white transition-colors">Project</Link>
            <span>/</span>
            <span className="text-blue-400">Scan #{id?.toString().slice(-4)}</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold tracking-tight mb-2">Security Audit Insights</h1>
              <p className="text-gray-400 max-w-2xl text-lg">
                Report generated on <span className="text-white font-medium">{new Date(scan?.created_at).toLocaleString()}</span>
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-white/5 space-x-1">
                {[
                  { id: 'ai', label: 'AI Audit', icon: ShieldCheck },
                  { id: 'semgrep', label: 'Semgrep Raw', icon: FileCode },
                  { id: 'codeql', label: 'CodeQL Raw', icon: Terminal },
                  { id: 'zap', label: 'ZAP Raw', icon: Zap },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setReportViewMode(mode.id as any)}
                    className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-bold text-[10px] whitespace-nowrap transition-all uppercase tracking-widest ${
                      reportViewMode === mode.id 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                        : 'text-gray-400 hover:text-white dark:hover:text-white'
                    }`}
                  >
                    <mode.icon size={14} />
                    <span>{mode.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => handleDownload('ai')}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-95 text-[10px] tracking-widest uppercase"
                  title="Download AI Enhanced Report"
                >
                  <Download size={16} />
                  <span>AI</span>
                </button>
                <button 
                  onClick={() => handleDownload('semgrep')}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 text-[10px] tracking-widest uppercase border border-white/5"
                  title="Download Raw Semgrep JSON"
                >
                  <FileCode size={16} />
                </button>
                <button 
                  onClick={() => handleDownload('codeql')}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 text-[10px] tracking-widest uppercase border border-white/5"
                  title="Download Raw CodeQL SARIF"
                >
                  <Terminal size={16} />
                </button>
                <button 
                  onClick={() => handleDownload('zap')}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 text-[10px] tracking-widest uppercase border border-white/5"
                  title="Download Raw ZAP JSON"
                >
                  <Zap size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-12">
        {reportViewMode === 'ai' ? (
          <>
            {/* Statistics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            { label: 'Fix Now', count: report?.summary?.fix_now_count || 0, color: 'text-red-600 dark:text-red-500', icon: ShieldAlert },
            { label: 'Backlog', count: report?.summary?.backlog_count || 0, color: 'text-orange-600 dark:text-orange-500', icon: Bug },
            { label: 'Raw Findings', count: report?.summary?.total_raw_findings || 0, color: 'text-blue-600 dark:text-blue-500', icon: Activity },
            { label: 'Posture', count: report?.summary?.posture?.toUpperCase() || 'N/A', color: 'text-blue-600 dark:text-blue-500', icon: Terminal },
          ].map((stat, i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-white/5 hover:border-blue-500/20 transition-all shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-lg bg-white/5 ${stat.color}`}>
                  <stat.icon size={24} />
                </div>
                <ArrowUpRight size={16} className="opacity-20" />
              </div>
              <p className="text-3xl font-bold mb-1">{stat.count}</p>
              <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Main Content Layout */}
        <div className="lg:grid lg:grid-cols-12 gap-8 items-start">
          {/* Issue List */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
               <h2 className="text-2xl font-bold flex items-center space-x-3">
                 <LayoutGrid className="text-blue-500" size={20} />
                 <span>Detailed Findings</span>
               </h2>
               
               <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-white/5">
                  {[
                    { id: 'all', label: 'All Findings' },
                    { id: 'code', label: 'Source Code' },
                    { id: 'runtime', label: 'Runtime' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                        activeTab === tab.id 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
               </div>
            </div>

            {filteredIssues?.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 p-20 rounded-[2.5rem] text-center border-dashed border-gray-200 dark:border-white/10 shadow-sm">
                <ShieldCheck className="mx-auto text-green-500 mb-4" size={48} />
                <h3 className="text-xl font-bold">No issues found in this category</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-2">The security audit engine has not detected any threats for the selected filter.</p>
              </div>
            ) : filteredIssues?.map((issue: any, index: number) => {
              const styles = getSeverityStyles(issue.severity);
              const isOpen = expandedIssue === index;
              
              return (
                <div 
                  key={index} 
                  className={`bg-white dark:bg-zinc-900 rounded-3xl border transition-all overflow-hidden shadow-sm ${isOpen ? 'border-gray-300 dark:border-white/20 ring-1 ring-gray-200 dark:ring-white/10' : 'border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10'}`}
                >
                  {/* Issue Header */}
                  <button 
                    onClick={() => setExpandedIssue(isOpen ? null : index)}
                    className="w-full text-left p-6 md:p-8 flex items-start justify-between"
                  >
                    <div className="flex items-start space-x-6">
                      <div className={`mt-1 h-3 w-3 rounded-full flex-shrink-0 ${styles.dot} shadow-[0_0_12px_rgba(var(--primary),0.2)]`} />
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter border ${styles.bg} ${styles.text} ${styles.border}`}>
                            {issue.severity}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter border ${issue.decision === 'fix_now' ? 'bg-red-500/10 text-red-600 dark:text-red-500 border-red-500/20' : 'bg-blue-500/10 text-blue-600 dark:text-blue-500 border-blue-500/20'}`}>
                            {issue.decision?.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] text-gray-500 dark:text-white/30 font-bold uppercase tracking-widest">{issue.ownership} • {issue.evidence_level}</span>
                        </div>
                        <h3 className="text-xl font-bold leading-tight text-gray-900 dark:text-white">{issue.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-white/40 font-mono">{issue.original_rule}</p>
                      </div>
                    </div>
                    <div className="ml-4 transition-transform duration-300">
                      {isOpen ? <ChevronUp className="text-gray-400" size={24} /> : <ChevronDown className="text-gray-400" size={24} />}
                    </div>
                  </button>

                  {/* Issue Details Content */}
                  {isOpen && (
                    <div className="px-8 pb-10 pt-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01]">
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                        {/* Technical Deep Dive */}
                        <div className="space-y-8">
                          <section>
                            <h4 className="text-xs font-black text-gray-500 dark:text-white/40 uppercase tracking-[0.2em] mb-3">Attack Vector & Location</h4>
                            
                            {(issue.instances && issue.instances.length > 0) ? (
                              <div className="space-y-4">
                                {issue.instances.map((inst: any, i: number) => (
                                  <div key={i} className="bg-gray-100 dark:bg-black/40 rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10">
                                    <div className="bg-gray-200/50 dark:bg-white/5 px-4 py-2.5 text-[10px] font-mono text-gray-600 dark:text-white/50 border-b border-gray-200 dark:border-white/5 flex justify-between">
                                       <span className="flex items-center space-x-2 truncate">
                                          <FileCode size={12} className="text-blue-500" />
                                          <span className="font-bold text-gray-700 dark:text-gray-300">File:</span>
                                          <span>{inst.path}</span>
                                       </span>
                                       <span className="bg-gray-300 dark:bg-white/10 px-2 py-0.5 rounded ml-2 text-gray-900 dark:text-white font-bold">L{inst.line}</span>
                                    </div>
                                    <pre className="p-5 overflow-x-auto text-[13px] font-mono text-gray-800 dark:text-gray-300 leading-6 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-white/10">
                                       {inst.code_snippet || "// Snippet not available for this location."}
                                    </pre>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="bg-gray-100 dark:bg-white/[0.02] p-4 rounded-xl border border-gray-200 dark:border-white/5">
                                <p className="text-xs text-gray-500 mb-2 font-bold uppercase tracking-widest">Historical Locations:</p>
                                <ul className="space-y-1">
                                  {issue.affected_locations?.map((loc: string, i: number) => (
                                    <li key={i} className="text-xs font-mono text-blue-600 dark:text-blue-400/80 bg-blue-500/5 px-3 py-1.5 rounded-lg border border-blue-500/10">
                                      {loc}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </section>

                          <section>
                            <h4 className="text-xs font-black text-gray-500 dark:text-white/40 uppercase tracking-[0.2em] mb-3">Analytical Reasoning</h4>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
                              {issue.reason}
                            </p>
                          </section>

                          <section className="bg-blue-500/5 p-5 rounded-2xl border border-blue-500/10">
                             <h4 className="text-xs font-black text-blue-400 uppercase tracking-[0.2em] mb-2 font-mono">MITIGATION • EXPLOITABILITY: {issue.exploitability?.toUpperCase()}</h4>
                            <p className="text-sm text-gray-300">{issue.recommended_action || "Standard remediation required."}</p>
                          </section>
                          
                          <div className="flex gap-4">
                             <button 
                                disabled={analyzing[index]}
                                onClick={() => runAiAnalysis(index)}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 py-3.5 rounded-2xl flex items-center justify-center space-x-2 font-black text-sm transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50"
                             >
                                <Zap size={18} fill="currentColor" />
                                <span>{analyzing[index] ? 'PROCESSING...' : aiAnalysis[index] ? 'REGENERATE FIX' : 'EXPLORE AI FIX'}</span>
                             </button>
                          </div>
                        </div>

                        {/* AI Fixed Code Window */}
                        <div className="flex flex-col h-full rounded-3xl overflow-hidden min-h-[500px] border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.07] to-purple-500/[0.07]">
                           <div className="p-6 flex-1 flex flex-col">
                              <h4 className="text-xs font-black text-blue-400 uppercase tracking-[0.2em] mb-6 flex items-center space-x-2">
                                 <Cpu size={14} />
                                 <span>AI Engineered Solution</span>
                              </h4>
                              
                              {!aiAnalysis[index] ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                                   <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 border border-blue-500/20">
                                      <Zap className="text-blue-500" size={32} />
                                   </div>
                                   <h5 className="text-lg font-bold mb-2">Autonomous Fix Engine</h5>
                                   <p className="text-sm text-gray-400 leading-relaxed">
                                      Launch AI analysis to generate production-ready code fixes, 
                                      unified diffs, and security justification for this vulnerability.
                                   </p>
                                </div>
                              ) : (
                                 <div className="space-y-6 flex-1">
                                    {aiAnalysis[index].ai_analysis?.error ? (
                                      <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/10 flex items-start space-x-3">
                                         <AlertCircle size={16} className="text-red-500 mt-0.5" />
                                         <p className="text-[13px] text-red-400 leading-relaxed font-bold">
                                            AI ERROR: {aiAnalysis[index].ai_analysis.error}
                                         </p>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/10 flex items-start space-x-3">
                                           <Activity size={16} className="text-blue-500 mt-0.5" />
                                           <p className="text-[13px] text-gray-300 leading-relaxed italic">
                                              {aiAnalysis[index].ai_analysis?.analysis}
                                           </p>
                                        </div>

                                        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                                           <div className="flex items-center justify-between mb-3">
                                              <h5 className="text-[10px] font-black text-white/30 uppercase tracking-[0.15em]">Refactored Code</h5>
                                              <button 
                                                 onClick={() => navigator.clipboard.writeText(aiAnalysis[index].ai_analysis?.fix_code)}
                                                 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center space-x-1 hover:text-blue-300 transition-colors"
                                              >
                                                 <Copy size={12} />
                                                 <span>Copy Code</span>
                                              </button>
                                           </div>
                                           <div className="flex-1 rounded-2xl overflow-hidden border border-white/5 bg-black/80 flex flex-col">
                                              <pre className="p-5 overflow-auto text-[12px] font-mono text-green-400 leading-normal flex-1 scrollbar-thin scrollbar-thumb-white/10">
                                                 {aiAnalysis[index].ai_analysis?.fix_code}
                                              </pre>
                                           </div>
                                        </div>

                                        <div className="bg-black/20 p-5 rounded-2xl border border-white/5">
                                           <h5 className="text-[10px] font-black text-white/30 uppercase tracking-[0.15em] mb-2">Mitigation Explanation</h5>
                                           <p className="text-xs text-gray-400 leading-relaxed">{aiAnalysis[index].ai_analysis?.explanation}</p>
                                        </div>
                                      </>
                                    )}
                                 </div>
                              )}
                           </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Sidebar: Health & Actions */}
          <div className="lg:col-span-4 space-y-6 mt-14 lg:mt-11">
             <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border-2 border-blue-500/10 dark:border-blue-500/20 bg-blue-500/[0.02] shadow-sm">
                <h3 className="text-xl font-bold mb-6 flex items-center space-x-3 text-gray-900 dark:text-white">
                  <ShieldCheck className="text-green-500" size={24} />
                  <span>Report Summary</span>
                </h3>
                
                <div className="space-y-6">
                   <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-white/5">
                      <span className="text-gray-500 dark:text-gray-400 text-sm">Actionable Issues</span>
                      <span className="text-gray-900 dark:text-white font-bold">
                        {report?.issues?.filter((i: any) => i.decision === 'fix_now' || i.decision === 'backlog').length || 0}
                      </span>
                   </div>
                   <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-white/5">
                      <span className="text-gray-500 dark:text-gray-400 text-sm">Resolved / Ignored</span>
                      <span className="text-gray-900 dark:text-white font-bold">
                        {report?.issues?.filter((i: any) => i.decision === 'ignore').length || 0}
                      </span>
                   </div>
                   <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-white/5">
                      <span className="text-gray-500 dark:text-gray-400 text-sm">Engine Confidence</span>
                      <span className="text-blue-600 dark:text-blue-400 font-bold">{getConfidenceLevel().toFixed(0)}%</span>
                   </div>
                </div>

                <div className="mt-8">
                   <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold opacity-60 uppercase text-gray-500 dark:text-gray-400">Security Score</span>
                      <span className={`text-sm font-bold ${calculateScore() < 50 ? 'text-red-600' : 'text-green-600'}`}>
                        {calculateScore()}%
                      </span>
                   </div>
                   <div className="w-full h-3 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-1000 ${calculateScore() < 50 ? 'bg-red-600' : 'bg-green-600'}`} style={{ width: `${calculateScore()}%` }} />
                   </div>
                </div>
             </div>

             <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] space-y-4 border border-gray-200 dark:border-white/5 shadow-sm">
                <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Audit Information</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                   This scan was executed using a combination of Semgrep, CodeQL, and Dynamic baseline scanning. All findings are normalized to an actionable LLM context.
                </p>
                <div className="space-y-3">
                   <button className="w-full py-3.5 px-6 rounded-2xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-800 dark:text-gray-300 text-sm font-bold transition-all border border-gray-200 dark:border-white/5 flex items-center justify-center space-x-2">
                      <ScrollText size={16} />
                      <span>Export Audit logs</span>
                   </button>
                </div>
             </div>
              </div>
            </div>
          </>
        ) : (
          /* RAW Tool Output View */
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-gray-200 dark:border-white/5 overflow-hidden shadow-xl min-h-[600px] flex flex-col">
             <div className="p-8 border-b border-gray-100 dark:border-white/5 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-2xl font-bold flex items-center space-x-3">
                    {reportViewMode === 'semgrep' ? <FileCode className="text-blue-500" /> : 
                     reportViewMode === 'zap' ? <Zap className="text-blue-500" /> :
                     <Terminal className="text-blue-500" />}
                    <span className="capitalize">{reportViewMode} Raw Output</span>
                  </h2>
                  <p className="text-gray-400 mt-1 text-sm">Direct underlying security engine findings for forensic analysis.</p>
                </div>
                <button 
                  onClick={() => handleDownload(reportViewMode as any)}
                  className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all text-[10px] tracking-widest uppercase shadow-lg shadow-blue-500/20"
                >
                  <Download size={14} />
                  <span>Download Raw {reportViewMode === 'codeql' ? 'SARIF' : 'JSON'}</span>
                </button>
             </div>
             <div className="flex-1 bg-black/95 relative group overflow-hidden flex flex-col">
                <div className="absolute top-4 right-6 opacity-40 group-hover:opacity-100 transition-opacity z-10">
                   <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] bg-white/5 px-3 py-1 rounded-full border border-white/10">Read Only</span>
                </div>
                <pre className="flex-1 p-10 text-[13px] font-mono text-blue-400/90 leading-relaxed overflow-auto scrollbar-thin scrollbar-thumb-white/10">
                   {scan?.raw_reports?.[reportViewMode] ? (
                      JSON.stringify(scan.raw_reports[reportViewMode], null, 2)
                   ) : (
                      `// No raw data available for ${reportViewMode}.\n// This might be because the scan is still running or the tool didn't generate a report.`
                   )}
                </pre>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
