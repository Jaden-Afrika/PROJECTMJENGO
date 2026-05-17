import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, query, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth } from './AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [entry, setEntry] = useState({ item: '', cost: '', type: 'Material' });
  const [logs, setLogs] = useState([]);

  // FETCH DATA (Persistence without LocalStorage)
  useEffect(() => {
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "projects"), {
      ...entry,
      uid: user.uid,
      createdAt: new Date()
    });
    setEntry({ item: '', cost: '', type: 'Material' });
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <header className="flex justify-between mb-6">
        <h1 className="text-xl font-bold">Mjengo Ledger</h1>
        <button onClick={logout} className="text-red-500 text-sm">Logout</button>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3 mb-8">
        <input 
          className="border p-2 w-full rounded"
          placeholder="Item (e.g. Cement)" 
          value={entry.item}
          onChange={(e) => setEntry({...entry, item: e.target.value})}
          required
        />
        <input 
          className="border p-2 w-full rounded"
          type="number" 
          placeholder="Cost (KES)" 
          value={entry.cost}
          onChange={(e) => setEntry({...entry, cost: e.target.value})}
          required
        />
        <button className="bg-blue-600 text-white w-full py-2 rounded">Add Log</button>
      </form>

      <div className="space-y-2">
        {logs.map(log => (
          <div key={log.id} className="p-3 border-b flex justify-between">
            <span>{log.item}</span>
            <span className="font-bold">KES {log.cost}</span>
          </div>
        ))}
      </div>
    </div>
  );
}