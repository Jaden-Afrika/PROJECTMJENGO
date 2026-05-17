import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { db, storage } from './firebase';
import { collection, addDoc, onSnapshot, query, where, doc, getDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const defaultMarketPrices = [
  { id: 'default-cement', materialName: 'Cement', unit: '50kg bag', averagePrice: 750, source: 'Starter benchmark', isDefault: true },
  { id: 'default-sand', materialName: 'Sand', unit: 'tonne', averagePrice: 2500, source: 'Starter benchmark', isDefault: true },
  { id: 'default-stones', materialName: 'Ballast stones', unit: 'tonne', averagePrice: 2800, source: 'Starter benchmark', isDefault: true },
  { id: 'default-timber', materialName: 'Timber', unit: 'piece', averagePrice: 450, source: 'Starter benchmark', isDefault: true },
  { id: 'default-rebar', materialName: 'Steel reinforcement bars', unit: 'piece', averagePrice: 1200, source: 'Starter benchmark', isDefault: true }
];

const normalizeMaterialName = (name) => name.trim().toLowerCase();

const getMarketPriceId = (userId, materialName) => {
  const safeName = normalizeMaterialName(materialName).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${userId}_${safeName}`;
};

const mergeMarketPrices = (savedPrices) => {
  const priceMap = new Map(defaultMarketPrices.map((item) => [normalizeMaterialName(item.materialName), item]));

  savedPrices.forEach((item) => {
    priceMap.set(normalizeMaterialName(item.materialName), item);
  });

  return Array.from(priceMap.values()).sort((a, b) => a.materialName.localeCompare(b.materialName));
};

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { projectId } = useParams();
  
  // Form States
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [logType, setLogType] = useState('material');
  const [searchTerm, setSearchTerm] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [marketMaterialName, setMarketMaterialName] = useState('');
  const [marketUnit, setMarketUnit] = useState('');
  const [marketAveragePrice, setMarketAveragePrice] = useState('');
  const [marketSource, setMarketSource] = useState('');
  const [marketError, setMarketError] = useState('');

  // Data State
  const [logs, setLogs] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [marketPrices, setMarketPrices] = useState(defaultMarketPrices);
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

  useEffect(() => {
    if (!projectId) return undefined;

    const q = query(collection(db, 'mjengo_progress_photos'), where('projectId', '==', projectId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const photoData = snapshot.docs.map((photoDoc) => ({ id: photoDoc.id, ...photoDoc.data() }));
      photoData.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setPhotos(photoData);
    });

    return () => unsubscribe();
  }, [projectId]);

  useEffect(() => {
    if (!user?.uid) return undefined;

    const q = query(collection(db, 'mjengo_market_prices'), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const savedPrices = snapshot.docs.map((priceDoc) => ({ id: priceDoc.id, ...priceDoc.data(), isDefault: false }));
      setMarketPrices(mergeMarketPrices(savedPrices));
    });

    return () => unsubscribe();
  }, [user?.uid]);

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

  const handlePhotoUpload = async (e) => {
    e.preventDefault();
    setPhotoError('');

    if (!projectId || !project) {
      setPhotoError('Project is still loading. Please try again.');
      return;
    }

    if (!photoFile) {
      setPhotoError('Please choose a progress image to upload.');
      return;
    }

    setUploadingPhoto(true);

    try {
      const safeFileName = photoFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const photoPath = `progress_photos/${projectId}/${Date.now()}-${safeFileName}`;
      const photoRef = ref(storage, photoPath);

      await uploadBytes(photoRef, photoFile);
      const imageUrl = await getDownloadURL(photoRef);

      await addDoc(collection(db, 'mjengo_progress_photos'), {
        userId: user.uid,
        projectId,
        projectName: project?.name || '',
        imageUrl,
        storagePath: photoPath,
        caption: photoCaption.trim(),
        fileName: photoFile.name,
        createdAt: new Date().toISOString()
      });

      setPhotoFile(null);
      setPhotoCaption('');
      e.target.reset();
    } catch (error) {
      console.error('Error uploading progress photo: ', error);
      setPhotoError('Could not upload the image. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleMarketPriceSubmit = async (e) => {
    e.preventDefault();
    setMarketError('');

    if (!marketMaterialName || !marketUnit || !marketAveragePrice) {
      setMarketError('Add the material, unit, and average price.');
      return;
    }

    const averagePrice = Number(marketAveragePrice);
    if (!Number.isFinite(averagePrice) || averagePrice <= 0) {
      setMarketError('Average price must be a valid amount greater than zero.');
      return;
    }

    try {
      await setDoc(doc(db, 'mjengo_market_prices', getMarketPriceId(user.uid, marketMaterialName)), {
        userId: user.uid,
        materialName: marketMaterialName.trim(),
        unit: marketUnit.trim(),
        averagePrice,
        source: marketSource.trim() || 'Manual market check',
        createdAt: new Date().toISOString()
      });

      setMarketMaterialName('');
      setMarketUnit('');
      setMarketAveragePrice('');
      setMarketSource('');
    } catch (error) {
      console.error('Error saving market price: ', error);
      setMarketError('Could not save this market price. Please try again.');
    }
  };

  const handleDeleteMarketPrice = async (priceId) => {
    try {
      await deleteDoc(doc(db, 'mjengo_market_prices', priceId));
    } catch (error) {
      console.error('Error deleting market price: ', error);
      setMarketError('Could not remove this market price. Please try again.');
    }
  };

  // 3. CALCULATE TOTAL SPENT ON THE FLY
  const totalSpent = logs.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const projectBudget = Number(project?.budget || 0);
  const selectedMarketPrice = marketPrices.find((item) => normalizeMaterialName(item.materialName) === normalizeMaterialName(itemName));
  const priceDifference = selectedMarketPrice && price
    ? Number(price) - Number(selectedMarketPrice.averagePrice || 0)
    : 0;
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredLogs = normalizedSearch
    ? logs.filter((log) => {
        const searchableText = [
          log.type,
          log.itemName,
          log.quantity,
          log.price,
          log.total,
          log.createdAt
        ].join(' ').toLowerCase();

        return searchableText.includes(normalizedSearch);
      })
    : logs;

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
          <h1 className="text-3xl font-black tracking-tight text-black">{project?.name || 'Project Ledger'}</h1>
          <p className="text-black font-semibold mt-1">
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
                  <option value="other">Other Expense</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
                  {logType === 'material' ? 'Item Name / Description' : logType === 'labor' ? 'Fundi / Contractor Name' : 'Expense Description'}
                </label>
                <input 
                  type="text" 
                  placeholder={logType === 'material' ? 'e.g., Bags of Bamburi Cement' : logType === 'labor' ? 'e.g., John (Mason)' : 'e.g., Permit fee or transport'}
                  value={itemName} 
                  onChange={(e) => setItemName(e.target.value)}
                  list={logType === 'material' ? 'market-materials' : undefined}
                  className="w-full bg-white border border-gray-300 rounded-xl p-3 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-600"
                />
                {logType === 'material' && (
                  <datalist id="market-materials">
                    {marketPrices.map((item) => (
                      <option key={item.id} value={item.materialName} />
                    ))}
                  </datalist>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
                    {logType === 'material' ? 'Quantity' : logType === 'labor' ? 'Days Worked' : 'Units'}
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
                    {logType === 'material' ? 'Unit Price (KES)' : logType === 'labor' ? 'Daily Rate (KES)' : 'Amount per Unit (KES)'}
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

              {logType === 'material' && selectedMarketPrice && (
                <div className="bg-white border border-orange-200 rounded-xl p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-orange-700">Market Average</p>
                  <p className="text-sm font-semibold text-black mt-1">
                    KES {Number(selectedMarketPrice.averagePrice || 0).toLocaleString()} per {selectedMarketPrice.unit}
                  </p>
                  {price && (
                    <p className={`text-xs font-bold mt-1 ${priceDifference > 0 ? 'text-red-600' : priceDifference < 0 ? 'text-green-700' : 'text-gray-600'}`}>
                      {priceDifference === 0
                        ? 'This rate matches the saved average.'
                        : `${Math.abs(priceDifference).toLocaleString()} KES ${priceDifference > 0 ? 'above' : 'below'} the saved average.`}
                    </p>
                  )}
                </div>
              )}

              <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold p-3 rounded-xl transition-all shadow-md shadow-orange-200 mt-2">
                Save to Digital Ledger
              </button>
            </form>
          </div>

          {/* Real-time Ledger Stream Column */}
          <div className="lg:col-span-2 bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-4 mb-4">
              <h2 className="text-lg font-bold text-black">Live Site Ledger</h2>
              <div className="w-full md:w-80">
                <label className="sr-only" htmlFor="ledger-search">Search previous entries</label>
                <input
                  id="ledger-search"
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search entries..."
                  className="w-full bg-white border border-gray-300 rounded-xl p-3 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-600"
                />
              </div>
            </div>
            
            {logs.length === 0 ? (
              <p className="text-gray-500 text-center py-12 font-medium">No expenses logged yet for this project.</p>
            ) : filteredLogs.length === 0 ? (
              <p className="text-gray-500 text-center py-12 font-medium">No entries match your search.</p>
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
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white transition-all">
                        <td className="py-4">
                          <span className={`px-2 py-1 rounded-md text-xs font-bold ${log.type === 'material' ? 'bg-orange-100 text-orange-700 border border-orange-300' : log.type === 'labor' ? 'bg-black text-white border border-black' : 'bg-white text-black border border-gray-400'}`}>
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

        <section className="mt-8 bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 border-b border-gray-200 pb-5 mb-6">
            <div>
              <h2 className="text-lg font-bold text-black">Average Market Prices</h2>
              <p className="text-sm font-medium text-gray-500 mt-1">Keep a reference list for common materials before logging purchases.</p>
            </div>

            <form onSubmit={handleMarketPriceSubmit} className="w-full lg:max-w-3xl grid grid-cols-1 md:grid-cols-5 gap-3">
              <input
                type="text"
                value={marketMaterialName}
                onChange={(e) => setMarketMaterialName(e.target.value)}
                placeholder="Material"
                className="md:col-span-1 w-full bg-white border border-gray-300 rounded-xl p-3 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-600"
              />
              <input
                type="text"
                value={marketUnit}
                onChange={(e) => setMarketUnit(e.target.value)}
                placeholder="Unit"
                className="md:col-span-1 w-full bg-white border border-gray-300 rounded-xl p-3 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-600"
              />
              <input
                type="number"
                min="1"
                value={marketAveragePrice}
                onChange={(e) => setMarketAveragePrice(e.target.value)}
                placeholder="Avg KES"
                className="md:col-span-1 w-full bg-white border border-gray-300 rounded-xl p-3 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-600"
              />
              <input
                type="text"
                value={marketSource}
                onChange={(e) => setMarketSource(e.target.value)}
                placeholder="Source"
                className="md:col-span-1 w-full bg-white border border-gray-300 rounded-xl p-3 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-600"
              />
              <button
                type="submit"
                className="w-full bg-black hover:bg-orange-700 text-white font-bold p-3 rounded-xl transition-all"
              >
                Save Price
              </button>
              {marketError && <p className="md:col-span-5 text-sm font-semibold text-red-600">{marketError}</p>}
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-300 text-xs font-bold uppercase tracking-wider text-gray-700">
                  <th className="pb-3">Material</th>
                  <th className="pb-3">Unit</th>
                  <th className="pb-3 text-right">Average Price</th>
                  <th className="pb-3">Source</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm font-medium">
                {marketPrices.map((item) => (
                  <tr key={item.id} className="hover:bg-white transition-all">
                    <td className="py-4 text-black font-semibold">{item.materialName}</td>
                    <td className="py-4 text-gray-700">{item.unit}</td>
                    <td className="py-4 text-right text-black font-bold">KES {Number(item.averagePrice || 0).toLocaleString()}</td>
                    <td className="py-4 text-gray-700">{item.source || 'Manual market check'}</td>
                    <td className="py-4 text-right">
                      {item.isDefault ? (
                        <span className="text-xs font-bold text-gray-500">Starter</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDeleteMarketPrice(item.id)}
                          className="text-xs font-bold text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-gray-200 pb-5 mb-6">
            <div>
              <h2 className="text-lg font-bold text-black">Progress Photo Bay</h2>
              <p className="text-sm font-medium text-gray-500 mt-1">Upload site progress images for this project.</p>
            </div>

            <form onSubmit={handlePhotoUpload} className="w-full md:max-w-md space-y-3">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                className="w-full bg-white border border-gray-300 rounded-xl p-3 text-black file:mr-4 file:rounded-lg file:border-0 file:bg-black file:px-4 file:py-2 file:font-bold file:text-white hover:file:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-600"
              />
              <input
                type="text"
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
                placeholder="Caption, phase, or site note"
                className="w-full bg-white border border-gray-300 rounded-xl p-3 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-600"
              />
              {photoError && <p className="text-sm font-semibold text-red-600">{photoError}</p>}
              <button
                type="submit"
                disabled={uploadingPhoto}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-bold p-3 rounded-xl transition-all shadow-md shadow-orange-200"
              >
                {uploadingPhoto ? 'Uploading Photo...' : 'Add Progress Photo'}
              </button>
            </form>
          </div>

          {photos.length === 0 ? (
            <p className="text-gray-500 text-center py-10 font-medium">No progress photos uploaded yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {photos.map((photo) => (
                <article key={photo.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <img
                    src={photo.imageUrl}
                    alt={photo.caption || 'Build progress'}
                    className="w-full aspect-video object-cover bg-gray-200"
                  />
                  <div className="p-4">
                    <p className="text-sm font-bold text-black">{photo.caption || 'Progress update'}</p>
                    <p className="text-xs font-medium text-gray-500 mt-1">
                      {photo.createdAt ? new Date(photo.createdAt).toLocaleDateString() : 'Recently added'}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
};

export default Dashboard;
