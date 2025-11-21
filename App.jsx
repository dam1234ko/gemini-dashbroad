import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart
} from 'recharts';
import { 
  Upload, FileText, TrendingUp, DollarSign, Users, Activity, Percent, BarChart2, 
  Sparkles, Bot, RefreshCw, AlertCircle 
} from 'lucide-react';

// --- 1. Gemini API 配置 ---
const API_KEY = ""; // 运行时会自动注入
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;

// --- 2. 工具函数 (Utility Functions) ---

const formatCurrency = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '-';
  // 修改：单位调整为美元 $
  return `$${Number(val).toFixed(2)}`;
};

const formatNumber = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '-';
  return Number(val).toLocaleString();
};

const formatPercent = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '-';
  return `${(Number(val) * 100).toFixed(2)}%`;
};

const formatDecimal = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '-';
  return Number(val).toFixed(2);
};

// --- 3. 子组件 (Sub-Components) ---

/**
 * 顶部核心指标卡片
 */
const StatCard = ({ title, value, subValue, icon: Icon, type = 'normal' }) => (
  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
    <div>
      <p className="text-sm text-gray-500 font-medium mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
      {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
    </div>
    <div className={`p-3 rounded-full ${type === 'money' ? 'bg-yellow-50 text-yellow-600' : type === 'user' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
      <Icon size={24} />
    </div>
  </div>
);

/**
 * 图表下方的智能简述组件 (本地逻辑)
 */
const ChartSummary = ({ data, metricKey, label, type = 'max' }) => {
  const summaryText = useMemo(() => {
    if (!data || data.length === 0) return "暂无数据可供分析。";
    
    const validData = data.filter(d => !isNaN(d[metricKey]) && d[metricKey] !== null);
    if (validData.length === 0) return `该周期内没有 ${label} 的有效数据。`;

    const values = validData.map(d => Number(d[metricKey]));
    const maxVal = Math.max(...values);
    const avgVal = values.reduce((a, b) => a + b, 0) / values.length;
    
    const maxDateItem = validData.find(d => Number(d[metricKey]) === maxVal);
    const maxDate = maxDateItem ? maxDateItem.date : '-';

    let formattedMax = formatDecimal(maxVal);
    let formattedAvg = formatDecimal(avgVal);
    
    if (label.includes('率') || label.includes('ROI')) {
        formattedMax = type === 'percent' ? formatPercent(maxVal) : formatDecimal(maxVal);
        formattedAvg = type === 'percent' ? formatPercent(avgVal) : formatDecimal(avgVal);
    } else if (label.includes('花费') || label.includes('CPA') || label.includes('LTV')) {
        formattedMax = formatCurrency(maxVal);
        formattedAvg = formatCurrency(avgVal);
    }

    let trendText = "数据波动较为平稳。";
    if (values.length > 1) {
        const first = values[0];
        const last = values[values.length - 1];
        if (last > first * 1.1) trendText = "近期呈现明显的上升趋势。";
        else if (last < first * 0.9) trendText = "近期呈现下降趋势。";
        else trendText = "整体保持在相对稳定的区间。";
    }

    return `数据简述：在此周期内，${label}的平均值为 ${formattedAvg}。峰值出现在 ${maxDate}，达到了 ${formattedMax}。${trendText}`;
  }, [data, metricKey, label, type]);

  return (
    <div className="mt-3 p-3 bg-slate-50 text-sm text-slate-600 rounded-lg border border-slate-100 flex items-start gap-2">
      <FileText size={16} className="mt-0.5 text-slate-400 shrink-0" />
      <p className="leading-relaxed">{summaryText}</p>
    </div>
  );
};

/**
 * ✨ AI 智能分析面板组件
 */
const AIInsightPanel = ({ data, summaryData }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateAnalysis = async () => {
    if (!data || data.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      // 1. 准备 Prompt 数据
      const recentData = data.slice(-7).map(d => ({
        日期: d.date,
        总花费: d.total_spend,
        总ROI: d.total_roi1,
        安卓CPA: d.and_cpa,
        iOSCPA: d.ios_cpa,
        iOSROI: d.ios_roi1
      }));

      const prompt = `
        你是一位资深的游戏/应用投放数据分析师。请根据以下提供的运营数据概览和最近7天的详细数据，生成一份简短精炼的【运营诊断报告】。
        
        【数据概览】：
        - 总花费: ${formatCurrency(summaryData.spend)}
        - 总安装: ${summaryData.install}
        - 注册率: ${(summaryData.regRate * 100).toFixed(2)}%
        - 平均首日ROI: ${(summaryData.roi1 * 100).toFixed(2)}%

        【最近7天详细数据趋势 (JSON)】：
        ${JSON.stringify(recentData)}

        请用中文回答，使用 Markdown 格式，包含以下三个部分：
        1. 📊 **趋势诊断**：分析花费、CPA 和 ROI 的近期走势（上升/下降/平稳），并指出任何异常波动。
        2. 🍎 **渠道对比**：对比安卓和 iOS 的表现（CPA 和 ROI），指出哪个渠道质量更高。
        3. 💡 **优化建议**：基于数据给出 3 条具体的投放调整建议（如：预算分配、出价调整方向）。
        
        语气要专业、客观且具有行动导向性。不要使用复杂的专业术语堆砌，要通俗易懂。
      `;

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) throw new Error('API 请求失败');
      
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (text) {
        setAnalysis(text);
      } else {
        throw new Error('未能生成分析结果');
      }

    } catch (err) {
      console.error(err);
      setError('分析生成失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 p-6 mb-8 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-100 rounded-full opacity-50 blur-xl"></div>
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 relative z-10">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
            <Sparkles className="text-indigo-500" size={20} />
            Gemini 智能分析助手
          </h3>
          <p className="text-indigo-600/80 text-sm mt-2 max-w-2xl">
            利用 Google Gemini 大模型，深度解读您的投放数据。一键生成趋势诊断、渠道对比分析及预算优化建议。
          </p>

          {!analysis && !loading && (
            <button 
              onClick={generateAnalysis}
              className="mt-6 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-full font-medium transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              <Bot size={18} />
              开始智能分析
            </button>
          )}

          {loading && (
            <div className="mt-6 flex items-center gap-3 text-indigo-700 animate-pulse">
              <RefreshCw className="animate-spin" size={20} />
              <span>正在分析数据趋势，生成策略建议中...</span>
            </div>
          )}

          {error && (
            <div className="mt-6 flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-100 inline-flex">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {analysis && (
        <div className="mt-6 bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-indigo-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="prose prose-indigo max-w-none">
            {analysis.split('\n').map((line, i) => {
              if (line.startsWith('###') || line.startsWith('**')) {
                return <h4 key={i} className="font-bold text-gray-800 mt-4 mb-2 text-lg">{line.replace(/[#*]/g, '')}</h4>;
              }
              if (line.trim().startsWith('-') || line.trim().startsWith('1.')) {
                 return <li key={i} className="text-gray-700 ml-4 list-disc my-1">{line.replace(/^[-*1.]+\s*/, '')}</li>;
              }
              if (line.trim() === '') return <br key={i} />;
              return <p key={i} className="text-gray-600 leading-relaxed">{line}</p>;
            })}
          </div>
          <div className="mt-6 flex justify-end">
            <button 
              onClick={generateAnalysis}
              className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <RefreshCw size={14} /> 重新生成
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- 4. 主应用组件 (Main App) ---

const App = () => {
  const [data, setData] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [fileName, setFileName] = useState(null);

  // --- 数据处理逻辑 ---
  
  const calculateSummary = useCallback((dataset) => {
    if (!dataset || dataset.length === 0) return;

    const totalSpend = dataset.reduce((acc, cur) => acc + (cur.total_spend || 0), 0);
    const totalInstall = dataset.reduce((acc, cur) => acc + (cur.total_install || 0), 0);
    const totalReg = dataset.reduce((acc, cur) => acc + (cur.total_reg || 0), 0);
    
    const avgRegRate = totalInstall > 0 ? totalReg / totalInstall : 0;
    const avgCPI = totalInstall > 0 ? totalSpend / totalInstall : 0;
    const validRoiCount = dataset.filter(d => d.total_roi1 > 0).length;
    const avgROI1 = validRoiCount > 0 ? dataset.reduce((acc, cur) => acc + (cur.total_roi1 || 0), 0) / validRoiCount : 0;

    setSummaryData({
      spend: totalSpend,
      install: totalInstall,
      reg: totalReg,
      regRate: avgRegRate,
      cpi: avgCPI,
      roi1: avgROI1
    });
  }, []);

  const parseCSV = useCallback((text) => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    let startIndex = 0;
    for(let i=0; i<lines.length; i++) {
        if (lines[i].match(/^\d{4}-\d{2}-\d{2}/)) {
            startIndex = i;
            break;
        }
    }
    
    const parsedData = [];
    for (let i = startIndex; i < lines.length; i++) {
      const row = lines[i].split(','); 
      if (!row[0] || row[0].includes('汇总') || row[0].includes('日期')) continue;

      const parseNum = (val) => {
        if (!val) return 0;
        const cleanVal = val.replace(/["',]/g, '').replace('%', '');
        const num = parseFloat(cleanVal);
        return isNaN(num) ? 0 : num;
      };

      // 修改：智能解析百分比函数 (专用于转化率)
      // 如果值含有 %，移除并除以100
      // 如果值是纯数字但大于10 (且不是安装数这种绝对值)，我们假设它是百分比格式 (例如 50 代表 50%)
      const parseRate = (val) => {
        if (!val) return 0;
        const isPercentString = val.includes('%');
        let num = parseNum(val);
        
        if (isPercentString) {
            return num / 100;
        }
        
        // 启发式修正：如果转化率大于 10 (即 1000%)，通常意味着源数据是 50 这种格式代表 50%
        // 正常转化率通常在 0.01 - 2.0 (1% - 200%) 之间
        if (num > 10) {
            return num / 100;
        }
        return num;
      };

      parsedData.push({
        date: row[0],
        weekday: row[1],
        // Overall
        total_spend: parseNum(row[2]),
        total_install: parseNum(row[3]),
        total_reg: parseNum(row[4]),
        total_regrate: parseRate(row[5]), // 使用智能解析
        total_cpi: parseNum(row[6]),
        total_cpa: parseNum(row[7]),
        total_ltv1: parseNum(row[8]),
        total_ltv3: parseNum(row[9]),
        total_ltv7: parseNum(row[10]),
        total_roi1: parseNum(row[11]),
        total_roi3: parseNum(row[12]),
        total_roi7: parseNum(row[13]),
        // And
        and_spend: parseNum(row[14]),
        and_install: parseNum(row[15]),
        and_reg: parseNum(row[16]),
        and_regrate: parseRate(row[17]), // 使用智能解析
        and_cpa: parseNum(row[18]),
        and_ltv1: parseNum(row[19]),
        and_ltv3: parseNum(row[20]),
        and_ltv7: parseNum(row[21]),
        and_roi1: parseNum(row[22]),
        and_roi3: parseNum(row[23]),
        and_roi7: parseNum(row[24]),
        // iOS
        ios_spend: parseNum(row[25]),
        ios_install: parseNum(row[26]),
        ios_reg: parseNum(row[27]),
        ios_regrate: parseRate(row[28]), // 使用智能解析
        ios_cpa: parseNum(row[29]),
        ios_ltv1: parseNum(row[30]),
        ios_ltv3: parseNum(row[31]),
        ios_ltv7: parseNum(row[32]),
        ios_roi1: parseNum(row[33]),
        ios_roi3: parseNum(row[34]),
        ios_roi7: parseNum(row[35]),
      });
    }

    if (parsedData.length > 1) {
        const firstDate = new Date(parsedData[0].date);
        const lastDate = new Date(parsedData[parsedData.length - 1].date);
        if (firstDate > lastDate) {
            parsedData.reverse();
        }
    }

    setData(parsedData);
    calculateSummary(parsedData);
  }, [calculateSummary]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  // 初始化 Mock 数据
  useEffect(() => {
    const mockData = [
      { 
        date: '2025-06-16', weekday: '一',
        total_spend: 2200.0, total_install: 180, total_reg: 200, total_regrate: 1.11, total_cpa: 11.00, total_ltv1: 0.38, total_ltv3: 0.45, total_ltv7: 0.48, total_roi1: 0.035, total_roi3: 0.042, total_roi7: 0.044,
        and_spend: 300.0, and_install: 110, and_reg: 120, and_regrate: 1.09, and_cpa: 2.50, and_ltv1: 0.11, and_ltv3: 0.11, and_ltv7: 0.11, and_roi1: 0.045, and_roi3: 0.045, and_roi7: 0.045,
        ios_spend: 1900.0, ios_install: 70, ios_reg: 80, ios_regrate: 1.14, ios_cpa: 23.75, ios_ltv1: 0.80, ios_ltv3: 0.95, ios_ltv7: 1.00, ios_roi1: 0.032, ios_roi3: 0.040, ios_roi7: 0.042
      },
      { 
        date: '2025-06-17', weekday: '二',
        total_spend: 2428.2, total_install: 202, total_reg: 225, total_regrate: 1.1139, total_cpi: 12.02, total_cpa: 10.79, total_ltv1: 0.4, total_ltv3: 0.47, total_ltv7: 0.49, total_roi1: 0.0372, total_roi3: 0.0434, total_roi7: 0.0455,
        and_spend: 327.55, and_install: 125, and_reg: 135, and_regrate: 1.08, and_cpa: 2.43, and_ltv1: 0.12, and_ltv3: 0.12, and_ltv7: 0.12, and_roi1: 0.0487, and_roi3: 0.0487, and_roi7: 0.0487,
        ios_spend: 2100.65, ios_install: 77, ios_reg: 90, ios_regrate: 1.1688, ios_cpa: 23.34, ios_ltv1: 0.83, ios_ltv3: 0.99, ios_ltv7: 1.05, ios_roi1: 0.0354, ios_roi3: 0.0426, ios_roi7: 0.0455
      },
      { 
        date: '2025-06-18', weekday: '三',
        total_spend: 2650.5, total_install: 250, total_reg: 270, total_regrate: 1.08, total_cpa: 9.81, total_ltv1: 0.45, total_ltv3: 0.52, total_ltv7: 0.55, total_roi1: 0.041, total_roi3: 0.048, total_roi7: 0.051,
        and_spend: 400.0, and_install: 170, and_reg: 180, and_regrate: 1.05, and_cpa: 2.22, and_ltv1: 0.15, and_ltv3: 0.18, and_ltv7: 0.20, and_roi1: 0.050, and_roi3: 0.060, and_roi7: 0.070,
        ios_spend: 2250.5, ios_install: 80, ios_reg: 90, ios_regrate: 1.12, ios_cpa: 25.00, ios_ltv1: 0.90, ios_ltv3: 1.10, ios_ltv7: 1.20, ios_roi1: 0.038, ios_roi3: 0.045, ios_roi7: 0.049
      }
    ];
    setData(mockData);
    calculateSummary(mockData);
  }, [calculateSummary]);

  const renderModule = (title, prefix, colorTheme) => {
    const colors = {
        bar: colorTheme === 'blue' ? '#3b82f6' : colorTheme === 'green' ? '#10b981' : '#8b5cf6',
        lineSecondary: '#f59e0b',
        ltv: ['#8884d8', '#82ca9d', '#ffc658'],
        roi: ['#ef4444', '#f97316', '#eab308']
    };

    return (
      <div className="mb-12 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-3">
          <div className={`w-1.5 h-6 rounded-full ${colorTheme === 'blue' ? 'bg-blue-600' : colorTheme === 'green' ? 'bg-green-600' : 'bg-purple-600'}`}></div>
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                    <DollarSign size={18} className="text-slate-400" /> 花费 & CPA趋势
                </h3>
            </div>
            <div className="h-72 bg-white rounded-xl border border-slate-100 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{top: 10, right: 10, left: 0, bottom: 0}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} />
                  <YAxis yAxisId="left" fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} label={{ value: '花费', angle: -90, position: 'insideLeft', style: {fill: '#cbd5e1'} }} />
                  <YAxis yAxisId="right" orientation="right" fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} label={{ value: 'CPA', angle: 90, position: 'insideRight', style: {fill: '#cbd5e1'} }} />
                  <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} labelStyle={{color: '#64748b', marginBottom: '0.5rem'}} formatter={(val, name) => [name === 'CPA' ? formatCurrency(val) : formatNumber(val), name]} />
                  <Legend iconType="circle" />
                  <Bar yAxisId="left" dataKey={`${prefix}_spend`} name="总花费" fill={colors.bar} radius={[4, 4, 0, 0]} barSize={30} />
                  <Line yAxisId="right" type="monotone" dataKey={`${prefix}_cpa`} name="CPA" stroke={colors.lineSecondary} strokeWidth={3} dot={{r:3, strokeWidth: 2, fill: '#fff'}} activeDot={{r: 6}} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <ChartSummary data={data} metricKey={`${prefix}_spend`} label="花费" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                    <Users size={18} className="text-slate-400" /> 注册量 & 转化率
                </h3>
            </div>
            <div className="h-72 bg-white rounded-xl border border-slate-100 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{top: 10, right: 10, left: 0, bottom: 0}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} />
                  <YAxis yAxisId="left" fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} label={{ value: '注册数', angle: -90, position: 'insideLeft', style: {fill: '#cbd5e1'} }} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(val)=>`${(val*100).toFixed(0)}%`} fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} />
                  <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} formatter={(val, name) => [name.includes('率') ? formatPercent(val) : val, name]} />
                  <Legend iconType="circle" />
                  <Bar yAxisId="left" dataKey={`${prefix}_reg`} name="总注册" fill={colors.bar} radius={[4, 4, 0, 0]} barSize={30} fillOpacity={0.8} />
                  <Line yAxisId="right" type="monotone" dataKey={`${prefix}_regrate`} name="注转率" stroke={colors.lineSecondary} strokeWidth={3} dot={{r:3, strokeWidth: 2, fill: '#fff'}} activeDot={{r: 6}} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <ChartSummary data={data} metricKey={`${prefix}_regrate`} label="转化率" type="percent" />
          </div>

          <div className="space-y-2">
             <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                    <TrendingUp size={18} className="text-slate-400" /> LTV 趋势 (1/3/7日)
                </h3>
            </div>
            <div className="h-72 bg-white rounded-xl border border-slate-100 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{top: 10, right: 10, left: 0, bottom: 0}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} />
                  <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} formatter={(val) => formatCurrency(val)} />
                  <Legend iconType="plainline" />
                  <Line type="monotone" dataKey={`${prefix}_ltv1`} name="首日LTV" stroke={colors.ltv[0]} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey={`${prefix}_ltv3`} name="3日LTV" stroke={colors.ltv[1]} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey={`${prefix}_ltv7`} name="7日LTV" stroke={colors.ltv[2]} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <ChartSummary data={data} metricKey={`${prefix}_ltv7`} label="7日LTV" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                    <Activity size={18} className="text-slate-400" /> ROI 趋势 (1/3/7日)
                </h3>
            </div>
            <div className="h-72 bg-white rounded-xl border border-slate-100 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{top: 10, right: 10, left: 0, bottom: 0}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} />
                  <YAxis tickFormatter={(val)=>`${(val*100).toFixed(0)}%`} fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} />
                  <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} formatter={(val) => formatPercent(val)} />
                  <Legend iconType="plainline" />
                  <Line type="monotone" dataKey={`${prefix}_roi1`} name="首日ROI" stroke={colors.roi[0]} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey={`${prefix}_roi3`} name="3日ROI" stroke={colors.roi[1]} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey={`${prefix}_roi7`} name="7日ROI" stroke={colors.roi[2]} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <ChartSummary data={data} metricKey={`${prefix}_roi7`} label="7日ROI" type="percent" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto">
        {/* Header & Upload */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg text-white">
                <BarChart2 size={24} />
              </div>
              数据分析仪表盘
            </h1>
            <p className="text-slate-500 mt-2 ml-1">神无歌项目 · 运营数据监控</p>
          </div>
          
          <div className="flex flex-col items-end gap-2">
             {fileName ? (
                <span className="text-xs font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                    已加载: {fileName}
                </span>
             ) : (
                <span className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                    当前使用演示数据
                </span>
             )}
            <label className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl cursor-pointer hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95">
              <Upload size={18} />
              <span className="font-medium">上传CSV数据</span>
              <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* Top Stats Cards (Overall) */}
        {summaryData && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <StatCard title="总花费" value={formatCurrency(summaryData.spend)} type="money" icon={DollarSign} />
            <StatCard title="总安装" value={formatNumber(summaryData.install)} type="user" icon={Users} />
            <StatCard title="总注册" value={formatNumber(summaryData.reg)} type="user" icon={Users} />
            <StatCard title="注册率" value={formatPercent(summaryData.regRate)} type="normal" icon={Percent} />
            <StatCard title="总CPI" value={formatCurrency(summaryData.cpi)} type="money" icon={TrendingUp} />
            <StatCard title="首日ROI" value={formatPercent(summaryData.roi1)} type="normal" icon={Activity} />
          </div>
        )}

        {/* ✨ Gemini AI Section */}
        {summaryData && (
          <AIInsightPanel data={data} summaryData={summaryData} />
        )}

        {/* Main Content Area */}
        <div className="space-y-8">
          {renderModule("总体数据概览 (Overall)", "total", "blue")}
          {renderModule("神无歌-And (Android)", "and", "green")}
          {renderModule("神无歌-iOS (iOS)", "ios", "purple")}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-slate-200 text-center text-slate-400 text-sm">
          <p>数据仪表盘生成器 © 2025 | Powered by Gemini API</p>
        </div>
      </div>
    </div>
  );
};

export default App;
