import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';

const Dashboard = () => {
  const { user, logout } = useAuth();
  
  // Form States
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [logType, setLogType] = useState('material'); // 'material' or 'labor'

  // Data State
  const [logs, setLogs] = useState([]);

  // 1. REAL-TIME DATA PERSISTENCE (No LocalStorage)
  useEffect(() => {
    const q = query(collection(db, 'mjengo_logs'), orderBy('createdAt', 'desc'));
    
    // onSnapshot streams live data straight from Firestore memory
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = [];
      snapshot.forEach((doc) => {
        logsData.push({ id: doc.id, ...doc.data() });
      });
      setLogs(logsData);
    });

    return () => unsubscribe();
  }, []);

  // 2. LOG EXPENSE SUBMISSION
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!itemName || !quantity || !price) return alert('Please fill all fields');

    try {
      await addDoc(collection(db, 'mjengo_logs'), {
        userId: user.uid,
        itemName,
        quantity: Number(quantity),
        price: Number(price),
        total: Number(quantity) * Number(price),
        type: logType,
        createdAt: new Date().toISOString()
      });

      // Clear Form Fields
      setItemName('');
      setQuantity('');
      setPrice('');
    } catch (error) {
      console.error("Error adding document: ", error);
    }
  };

  // 3. CALCULATE TOTAL SPENT ON THE FLY
  const totalSpent = logs.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Header Block */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-6 mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">PROJECT MJENGO</h1>
            <p className="text-slate-500 font-medium">📍 Three Bedroom House Site Ledger</p>
          </div>
          <div className="flex items-center gap-4 bg-white p-2 rounded-xl shadow-sm border">
            <span className="text-sm font-semibold text-slate-600 px-2">Site Manager: {user?.displayName}</span>
            <button onClick={logout} className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-bold transition-all">
              Log Out
            </button>
          </div>
        </header>

        {/* Metrics Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Project Budget</h3>
            <p className="text-2xl font-black mt-1 text-slate-700">KES 2,500,000</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm bg-emerald-50/50">
            <h3 className="text-sm font-bold text-emerald-600 uppercase tracking-wider">Total Funds Spent</h3>
            <p className="text-3xl font-black mt-1 text-emerald-700">KES {totalSpent.toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Remaining Balance</h3>
            <p className="text-2xl font-black mt-1 text-blue-600">KES {(2500000 - totalSpent).toLocaleString()}</p>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Input Form Column */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit">
            <h2 className="text-lg font-bold mb-4 text-slate-900 border-b pb-2">Log New Entry</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Entry Type</label>
                <select 
                  value={logType} 
                  onChange={(e) => setLogType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="material">Material (Cement, Sand, Stones)</option>
                  <option value="labor">Labor / Fundi Wages</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  {logType === 'material' ? 'Item Name / Description' : 'Fundi / Contractor Name'}
                </label>
                <input 
                  type="text" 
                  placeholder={logType === 'material' ? 'e.g., Bags of Bamburi Cement' : 'e.g., John (Mason)'}
                  value={itemName} 
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {logType === 'material' ? 'Quantity' : 'Days Worked'}
                  </label>
                  <input 
                    type="number" 
                    placeholder="0"
                    value={quantity} 
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {logType === 'material' ? 'Unit Price (KES)' : 'Daily Rate (KES)'}
                  </label>
                  <input 
                    type="number" 
                    placeholder="0"
                    value={price} 
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-xl transition-all shadow-md shadow-blue-200 mt-2">
                Save to Digital Ledger
              </button>
            </form>
          </div>

          {/* Real-time Ledger Stream Column */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold mb-4 text-slate-900 border-b pb-2">Live Site Ledger</h2>
            
            {logs.length === 0 ? (
              <p className="text-slate-400 text-center py-12 font-medium">No expenses logged yet for this project.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b text-xs font-bold uppercase tracking-wider text-slate-400">
                      <th className="pb-3">Type</th>
                      <th className="pb-3">Description / Name</th>
                      <th className="pb-3 text-right">Qty / Days</th>
                      <th className="pb-3 text-right">Rate</th>
                      <th className="pb-3 text-right">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm font-medium">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-all">
                        <td className="py-4">
                          <span className={`px-2 py-1 rounded-md text-xs font-bold ${log.type === 'material' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                            {log.type}
                          </span>
                        </td>
                        <td className="py-4 text-slate-900 font-semibold">{log.itemName}</td>
                        <td className="py-4 text-right text-slate-600">{log.quantity}</td>
                        <td className="py-4 text-right text-slate-600">KES {log.price.toLocaleString()}</td>
                        <td className="py-4 text-right text-slate-900 font-bold">KES {log.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;