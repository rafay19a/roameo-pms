import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Plus, Edit2, Trash2, UtensilsCrossed } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ToastContainer';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
}

const TEAL_BTN: React.CSSProperties = {
  background: 'linear-gradient(135deg, #6F8F97 0%, #4F6F76 100%)',
};

const INPUT_CLS = 'block w-full rounded-lg border border-roameoBorder bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-roameoAccent/40 focus:border-roameoAccent transition';

const CATEGORY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  Food:     { bg: 'bg-amber-50',    text: 'text-amber-700',   dot: '#F59E0B' },
  Beverage: { bg: 'bg-blue-50',     text: 'text-blue-700',    dot: '#3B82F6' },
  Dessert:  { bg: 'bg-pink-50',     text: 'text-pink-700',    dot: '#EC4899' },
  Other:    { bg: 'bg-slate-50',    text: 'text-slate-600',   dot: '#64748B' },
};

const categoryStyle = (cat: string) =>
  CATEGORY_COLORS[cat] ?? CATEGORY_COLORS['Other'];

// ─── MenuModal ────────────────────────────────────────────────────────────────

interface MenuModalProps {
  item: MenuItem | null;
  onClose: () => void;
  onSave: (msg: string) => void;
}

const MenuModal: React.FC<MenuModalProps> = ({ item, onClose, onSave }) => {
  const [form, setForm] = useState({
    name:     item?.name     ?? '',
    price:    item?.price    ?? 0,
    category: item?.category ?? 'Food',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), category: form.category, price: Number(form.price) };
      if (item) {
        const { error } = await supabase.from('menu_items').update(payload).eq('id', item.id);
        if (error) throw error;
        onSave('Menu item updated');
      } else {
        const { error } = await supabase.from('menu_items').insert([payload]);
        if (error) throw error;
        onSave('Menu item added');
      }
    } catch (err: any) {
      console.error('Error saving menu item:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-6"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
      >
        <h3 className="text-lg font-semibold text-slate-800 mb-5">
          {item ? 'Edit Menu Item' : 'Add Menu Item'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Name</label>
            <input
              type="text"
              required
              className={INPUT_CLS}
              placeholder="e.g. Grilled Chicken"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Category</label>
            <select
              className={INPUT_CLS}
              value={form.category}
              onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
            >
              <option>Food</option>
              <option>Beverage</option>
              <option>Dessert</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Price (Rs)</label>
            <input
              type="number"
              required
              min="0"
              step="1"
              className={INPUT_CLS}
              placeholder="0"
              value={form.price}
              onChange={e => setForm(p => ({ ...p, price: Number(e.target.value) }))}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              style={TEAL_BTN}
            >
              {saving ? 'Saving…' : (item ? 'Save Changes' : 'Add Item')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-roameoBorder text-sm font-semibold text-slate-600 hover:bg-roameoSurface transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Menu page ────────────────────────────────────────────────────────────────

export const Menu: React.FC = () => {
  const [items, setItems]           = useState<MenuItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const { toasts, showToast }       = useToast();

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('category')
        .order('name');
      if (error) throw error;
      setItems(data ?? []);
    } catch (err) {
      console.error('Error fetching menu items:', err);
      showToast('Failed to load menu items', 'error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const grouped = useMemo(() => {
    const map: Record<string, MenuItem[]> = {};
    for (const item of items) {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    }
    return map;
  }, [items]);

  const categories = Object.keys(grouped).sort();

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingItem(null);
    setShowModal(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    const prev = items;
    setItems(p => p.filter(i => i.id !== id));
    try {
      const { error } = await supabase.from('menu_items').delete().eq('id', id);
      if (error) throw error;
      showToast('Item deleted');
    } catch (err) {
      console.error('Error deleting menu item:', err);
      setItems(prev);
      showToast('Failed to delete item', 'error');
    }
  };

  const handleSave = (msg: string) => {
    setShowModal(false);
    showToast(msg);
    fetchItems();
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

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Menu Items</h1>
          <p className="text-sm text-slate-500 mt-1">Manage room service food &amp; beverage items</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
          style={TEAL_BTN}
        >
          <Plus className="h-4 w-4" />
          Add Item
        </button>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-2xl"
          style={{ background: '#F5F9FA', border: '1px solid rgba(212,230,234,0.6)' }}
        >
          <UtensilsCrossed className="h-12 w-12 text-roameoMuted mb-4" />
          <p className="text-base font-semibold text-slate-600">No menu items yet</p>
          <p className="text-sm text-slate-400 mt-1">Add your first item to get started</p>
          <button
            onClick={handleAdd}
            className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
            style={TEAL_BTN}
          >
            <Plus className="h-4 w-4" /> Add Item
          </button>
        </div>
      )}

      {/* Grouped by category */}
      {categories.map(cat => {
        const style = categoryStyle(cat);
        return (
          <div
            key={cat}
            className="bg-white rounded-2xl overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid rgba(212,230,234,0.6)' }}
          >
            {/* Category header */}
            <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <span
                className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                style={{ background: style.dot }}
              />
              <h2 className="text-sm font-semibold text-slate-700">{cat}</h2>
              <span
                className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}
              >
                {grouped[cat].length} {grouped[cat].length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Items table */}
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide py-3 pl-6 pr-3">Name</th>
                  <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide py-3 px-6">Price</th>
                  <th className="py-3 pr-6 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {grouped[cat].map(item => (
                  <tr key={item.id} className="group hover:bg-roameoSurface/60 transition">
                    <td className="py-3.5 pl-6 pr-3">
                      <span className="text-sm font-medium text-slate-800">{item.name}</span>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <span className="text-sm font-semibold text-roameoAccent">{formatCurrency(item.price)}</span>
                    </td>
                    <td className="py-3.5 pr-6">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-1.5 rounded-lg hover:bg-roameoBorder/60 text-slate-500 hover:text-roameoAccent transition"
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-500 transition"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {showModal && (
        <MenuModal
          item={editingItem}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
};
