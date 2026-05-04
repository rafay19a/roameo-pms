import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { BedDouble, CalendarCheck, DollarSign, TrendingUp, Percent } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface MonthlyData {
  month: string;
  revenue: number;
}

interface Stats {
  totalRooms: number;
  activeBookings: number;
  todayRevenue: number;
  occupancyRate: number;
}

const statCards = (stats: Stats) => [
  {
    label: 'Total Rooms',
    value: stats.totalRooms.toString(),
    icon: BedDouble,
    iconBg: '#EBF4F6',
    iconColor: '#4F6F76',
    trend: null,
  },
  {
    label: 'Active Bookings',
    value: stats.activeBookings.toString(),
    icon: CalendarCheck,
    iconBg: '#E6F6F4',
    iconColor: '#0D9488',
    trend: null,
  },
  {
    label: 'Occupancy Rate',
    value: `${stats.occupancyRate}%`,
    icon: Percent,
    iconBg: '#F0FDF4',
    iconColor: '#16A34A',
    trend: null,
  },
  {
    label: "Today's Revenue",
    value: formatCurrency(stats.todayRevenue),
    icon: DollarSign,
    iconBg: '#FEFCE8',
    iconColor: '#CA8A04',
    trend: null,
  },
];

function buildMonthlyBuckets(invoices: { amount: number; created_at: string }[]): MonthlyData[] {
  const ordered: string[] = [];
  const buckets: Record<string, number> = {};

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = d.toLocaleString('en-US', { month: 'short' });
    ordered.push(key);
    buckets[key] = 0;
  }

  invoices.forEach((inv) => {
    const key = new Date(inv.created_at).toLocaleString('en-US', { month: 'short' });
    if (key in buckets) buckets[key] += Number(inv.amount || 0);
  });

  return ordered.map((month) => ({ month, revenue: buckets[month] }));
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="bg-white rounded-xl px-4 py-3 text-sm"
      style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.10)', border: '1px solid #D4E6EA' }}
    >
      <p className="font-semibold text-slate-700 mb-0.5">{label}</p>
      <p className="text-roameoAccent font-bold">{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats>({
    totalRooms: 0,
    activeBookings: 0,
    todayRevenue: 0,
    occupancyRate: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [{ count: roomsCount }, { count: bookingsCount }, { data: todayInvoices }, { data: allInvoices }] =
        await Promise.all([
          supabase.from('rooms').select('*', { count: 'exact', head: true }),
          supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .gte('check_out', today)
            .lte('check_in', today),
          supabase
            .from('invoices')
            .select('amount')
            .gte('created_at', `${today}T00:00:00.000Z`)
            .lte('created_at', `${today}T23:59:59.999Z`),
          supabase
            .from('invoices')
            .select('amount, created_at')
            .gte(
              'created_at',
              (() => {
                const d = new Date();
                d.setMonth(d.getMonth() - 5);
                d.setDate(1);
                d.setHours(0, 0, 0, 0);
                return d.toISOString();
              })()
            ),
        ]);

      const rooms = roomsCount || 0;
      const bookings = bookingsCount || 0;
      const revenue = todayInvoices?.reduce((s, i) => s + Number(i.amount || 0), 0) ?? 0;
      const occupancy = rooms > 0 ? Math.round((bookings / rooms) * 100) : 0;

      setStats({ totalRooms: rooms, activeBookings: bookings, todayRevenue: revenue, occupancyRate: occupancy });
      setMonthlyData(buildMonthlyBuckets(allInvoices ?? []));
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="h-9 w-9 rounded-full border-2 border-roameoPrimary"
          style={{ borderTopColor: 'transparent', animation: 'spin-ring 0.75s linear infinite' }}
        />
      </div>
    );
  }

  const cards = statCards(stats);

  return (
    <div className="space-y-8">
      {/* ── Page header ─────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* ── Stats grid ──────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-2xl p-6 flex items-start gap-4 transition-shadow duration-200 hover:shadow-md"
            style={{
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
              border: '1px solid rgba(212,230,234,0.6)',
            }}
          >
            <div
              className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: card.iconBg }}
            >
              <card.icon className="h-5 w-5" style={{ color: card.iconColor }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{card.label}</p>
              <p className="text-2xl font-bold text-slate-800 mt-1 leading-none">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Monthly Revenue Chart ────────────────── */}
      <div
        className="bg-white rounded-2xl p-6"
        style={{
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
          border: '1px solid rgba(212,230,234,0.6)',
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Monthly Revenue</h3>
            <p className="text-sm text-slate-400 mt-0.5">Last 6 months</p>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-roameoAccent" />
            <span className="text-sm font-medium text-roameoAccent">Revenue trend</span>
          </div>
        </div>

        {monthlyData.every((d) => d.revenue === 0) ? (
          <div className="h-56 flex flex-col items-center justify-center rounded-xl" style={{ background: '#F5F9FA' }}>
            <TrendingUp className="h-10 w-10 text-roameoMuted mb-3" />
            <p className="text-sm font-medium text-slate-500">No revenue data yet</p>
            <p className="text-xs text-slate-400 mt-1">Data will appear once invoices are created</p>
          </div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barSize={28} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#EDF2F4" strokeDasharray="0" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94A3B8', fontSize: 12, fontWeight: 500 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                  tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                  width={44}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(111,143,151,0.06)', radius: 8 } as any} />
                <Bar dataKey="revenue" fill="#6F8F97" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
