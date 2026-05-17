import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, query, where, doc, getDoc } from 'firebase/firestore';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { projectId } = useParams();
  
  // Form States
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [logType, setLogType] = useState('material'); // 'material' or 'labor'

  // Data State
  const [logs, setLogs] = useState([]);
  const [project, setProject] = useState(null);
  const [projectError, setProjectError] = useState('');

  useEffect(() => {
    if (!projectId) return undefined;

    let isActive = true;

    const loadProject = async () => {
      try {
        const projectSnapshot = await getDoc(doc(db, 'mjengo_projects', projectId));

        if (!isActive) return;

        if (!projectSnapshot.exists()) {
          setProjectError('This project could not be found.');
          return;
        }

        const projectData = { id: projectSnapshot.id, ...projectSnapshot.data() };

        if (projectData.userId !== user?.uid) {
          setProjectError('You do not have access to this project.');
          return;
        }

        setProject(projectData);
        setProjectError('');
      } catch (error) {
        console.error('Error loading project: ', error);
        if (isActive) setProjectError('Could not load this project.');
      }
    };

    loadProject();

    return () => {
      isActive = false;
    };
  }, [projectId, user?.uid]);

  // 1. REAL-TIME DATA PERSISTENCE (No LocalStorage)
  useEffect(() => {
    if (!projectId) return undefined;

    const q = query(collection(db, 'mjengo_logs'), where('projectId', '==', projectId));
    
    // onSnapshot streams live data straight from Firestore memory
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map((logDoc) => ({ id: logDoc.id, ...logDoc.data() }));
      logsData.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setLogs(logsData);
    });

    return () => unsubscribe();
  }, [projectId]);

  // 2. LOG EXPENSE SUBMISSION
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!projectId || !project) return alert('Project is still loading. Please try again.');
    if (!itemName || !quantity || !price) return alert('Please fill all fields');

    try {
      await addDoc(collection(db, 'mjengo_logs'), {
        userId: user.uid,
        projectId,
        projectName: project?.name || '',
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
  const totalSpent = logs.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const projectBudget = Number(project?.budget || 0);

  if (projectError) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-lg shadow-sm p-6 text-center">
          <h1 className="text-2xl font-black text-black">Project Unavailable</h1>
          <p className="text-gray-600 font-medium mt-2">{projectError}</p>
          <Link to="/projects" className="inline-block mt-6 bg-orange-600 hover:bg-orange-700 text-white font-bold px-5 py-3 rounded-lg">
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
  <div 
    className="min-h-screen bg-cover bg-center bg-no-repeat relative p-4 md:p-8"
    style={{ 
      backgroundImage: `url('/dashbg.jpg')` 
    }}
  >
    {/* Clean, light overlay so the white cards and text pop perfectly */}
    <div className="absolute inset-0 bg-white/25 backdrop-blur-[1px] z-0"></div>
{/* Content Wrapper */}
    <div className="max-w-5xl mx-auto relative z-10">
      
      {/* Header Block */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-6 mb-8 gap-4 border-slate-300">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">{project?.name || 'Project Ledger'}</h1>
          <p className="text-slate-600 font-semibold mt-1">
            {project?.location || 'Loading project'}{project?.type ? ` • ${project.type}` : ''}
          </p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 rounded-xl shadow-sm border">
          <Link to="/projects" className="bg-black hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all">
            Projects
          </Link>
          <span className="text-sm font-semibold text-slate-600 px-2">Site Manager: {user?.displayName}</span>
          <button onClick={logout} className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-bold transition-all">
            Log Out
          </button>
        </div>
      </header>

        {/* Metrics Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider">Total Project Budget</h3>
            <p className="text-2xl font-black mt-1 text-black">KES {projectBudget.toLocaleString()}</p>
          </div>
          <div className="bg-orange-50 p-6 rounded-2xl border border-orange-200 shadow-sm">
            <h3 className="text-sm font-bold text-orange-600 uppercase tracking-wider">Total Funds Spent</h3>
            <p className="text-3xl font-black mt-1 text-orange-700">KES {totalSpent.toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider">Remaining Balance</h3>
            <p className="text-2xl font-black mt-1 text-orange-600">KES {(projectBudget - totalSpent).toLocaleString()}</p>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Input Form Column */}
          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-sm h-fit">
            <h2 className="text-lg font-bold mb-4 text-black border-b border-gray-200 pb-2">Log New Entry</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">Entry Type</label>
                <select 
                  value={logType} 
                  onChange={(e) => setLogType(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-3 font-medium text-black focus:outline-none focus:ring-2 focus:ring-orange-600"
                >
                  <option value="material">Material (Cement, Sand, Stones)</option>
                  <option value="labor">Labor / Fundi Wages</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
                  {logType === 'material' ? 'Item Name / Description' : 'Fundi / Contractor Name'}
                </label>
                <input 
                  type="text" 
                  placeholder={logType === 'material' ? 'e.g., Bags of Bamburi Cement' : 'e.g., John (Mason)'}
                  value={itemName} 
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-3 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
                    {logType === 'material' ? 'Quantity' : 'Days Worked'}
                  </label>
                  <input 
                    type="number" 
                    placeholder="0"
                    value={quantity} 
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-3 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
                    {logType === 'material' ? 'Unit Price (KES)' : 'Daily Rate (KES)'}
                  </label>
                  <input 
                    type="number" 
                    placeholder="0"
                    value={price} 
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-3 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>
              </div>

              <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold p-3 rounded-xl transition-all shadow-md shadow-orange-200 mt-2">
                Save to Digital Ledger
              </button>
            </form>
          </div>

          {/* Real-time Ledger Stream Column */}
          <div className="lg:col-span-2 bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h2 className="text-lg font-bold mb-4 text-black border-b border-gray-200 pb-2">Live Site Ledger</h2>
            
            {logs.length === 0 ? (
              <p className="text-gray-500 text-center py-12 font-medium">No expenses logged yet for this project.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-300 text-xs font-bold uppercase tracking-wider text-gray-700">
                      <th className="pb-3">Type</th>
                      <th className="pb-3">Description / Name</th>
                      <th className="pb-3 text-right">Qty / Days</th>
                      <th className="pb-3 text-right">Rate</th>
                      <th className="pb-3 text-right">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-sm font-medium">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-white transition-all">
                        <td className="py-4">
                          <span className={`px-2 py-1 rounded-md text-xs font-bold ${log.type === 'material' ? 'bg-orange-100 text-orange-700 border border-orange-300' : 'bg-black text-white border border-black'}`}>
                            {log.type}
                          </span>
                        </td>
                        <td className="py-4 text-black font-semibold">{log.itemName}</td>
                        <td className="py-4 text-right text-gray-700">{log.quantity}</td>
                        <td className="py-4 text-right text-gray-700">KES {log.price.toLocaleString()}</td>
                        <td className="py-4 text-right text-black font-bold">KES {log.total.toLocaleString()}</td>
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
