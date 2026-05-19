import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { db, storage } from './firebase';
import { collection, addDoc, onSnapshot, query, where, doc, getDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

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

const getPhotoUploadError = (error) => {
  if (error?.message === 'Upload timed out') {
    return 'The upload timed out. Please check your connection and try again.';
  }

  if (error?.code === 'storage/unauthorized') {
    return 'You do not have permission to upload images for this project.';
  }

  if (error?.code === 'storage/quota-exceeded') {
    return 'Storage quota has been exceeded. Please try again later.';
  }

  if (error?.code === 'storage/retry-limit-exceeded') {
    return 'The upload timed out. Please check your connection and try again.';
  }

  return 'Could not upload the image. Please try again.';
};

const uploadPhotoFile = (photoRef, photoFile, onProgress) => new Promise((resolve, reject) => {
  let settled = false;
  const uploadTask = uploadBytesResumable(photoRef, photoFile, {
    contentType: photoFile.type
  });

  const timeoutId = setTimeout(() => {
    if (settled) return;
    settled = true;
    uploadTask.cancel();
    reject(new Error('Upload timed out'));
  }, 120000);

  uploadTask.on(
    'state_changed',
    (snapshot) => {
      const progress = snapshot.totalBytes
        ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
        : 0;
      onProgress(progress);
    },
    (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      reject(error);
    },
    () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      onProgress(100);
      resolve(uploadTask.snapshot);
    }
  );
});

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { projectId } = useParams();
  
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [logType, setLogType] = useState('material');
  const [searchTerm, setSearchTerm] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploadProgress, setPhotoUploadProgress] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [marketMaterialName, setMarketMaterialName] = useState('');
  const [marketUnit, setMarketUnit] = useState('');
  const [marketAveragePrice, setMarketAveragePrice] = useState('');
  const [marketSource, setMarketSource] = useState('');
  const [marketError, setMarketError] = useState('');

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

  useEffect(() => {
    if (!projectId) return undefined;

    const q = query(collection(db, 'mjengo_logs'), where('projectId', '==', projectId));
    
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

    if (!photoFile.type?.startsWith('image/')) {
      setPhotoError('Please choose a valid image file.');
      return;
    }

    if (photoFile.size > 10 * 1024 * 1024) {
      setPhotoError('Please choose an image under 10 MB.');
      return;
    }

    setUploadingPhoto(true);
    setPhotoUploadProgress(0);

    try {
      const safeFileName = photoFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const photoPath = `progress_photos/${projectId}/${Date.now()}-${safeFileName}`;
      const photoRef = ref(storage, photoPath);

      const uploadSnapshot = await uploadPhotoFile(photoRef, photoFile, setPhotoUploadProgress);
      const imageUrl = await getDownloadURL(uploadSnapshot.ref);

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
      setPhotoError(getPhotoUploadError(error));
    } finally {
      setUploadingPhoto(false);
      setPhotoUploadProgress(null);
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-zinc-900/30 border border-zinc-800 rounded-md p-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">Project Unavailable</h1>
          <p className="text-zinc-400 font-medium mt-2">{projectError}</p>
          <Link to="/projects" className="inline-block mt-6 bg-orange-600 hover:bg-orange-500 text-black font-bold px-5 py-2.5 rounded-md transition-colors">
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 md:px-8 md:py-8">
        <header className="flex flex-col gap-5 border-b border-zinc-800 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">{project?.name || 'Project Ledger'}</h1>
            <p className="mt-1 text-sm font-medium text-zinc-500">
              {project?.location || 'Loading project'}{project?.type ? ` / ${project.type}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Link to="/projects" className="text-sm font-semibold text-zinc-400 transition-opacity hover:opacity-70">
              Projects
            </Link>
            <span className="text-sm font-medium text-zinc-500">Site Manager: {user?.displayName}</span>
            <button
              onClick={logout}
              className="rounded-md border border-zinc-800 px-3 py-1.5 text-sm font-semibold text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white"
            >
              Log Out
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 py-6 lg:grid-cols-3">
          <aside className="space-y-6 lg:col-span-1">
            <section className="border border-zinc-800 bg-zinc-900/30 p-5">
              <h2 className="border-b border-zinc-800 pb-3 text-lg font-bold tracking-tight text-white">Log New Entry</h2>
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">Entry Type</label>
                  <select
                    value={logType}
                    onChange={(e) => setLogType(e.target.value)}
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm font-medium text-white transition-colors focus:border-orange-500 focus:outline-none"
                  >
                    <option value="material">Material (Cement, Sand, Stones)</option>
                    <option value="labor">Labor / Fundi Wages</option>
                    <option value="other">Other Expense</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    {logType === 'material' ? 'Item Name / Description' : logType === 'labor' ? 'Fundi / Contractor Name' : 'Expense Description'}
                  </label>
                  <input
                    type="text"
                    placeholder={logType === 'material' ? 'e.g., Bags of Bamburi Cement' : logType === 'labor' ? 'e.g., John (Mason)' : 'e.g., Permit fee or transport'}
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    list={logType === 'material' ? 'market-materials' : undefined}
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white transition-colors placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
                  />
                  {logType === 'material' && (
                    <datalist id="market-materials">
                      {marketPrices.map((item) => (
                        <option key={item.id} value={item.materialName} />
                      ))}
                    </datalist>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      {logType === 'material' ? 'Quantity' : logType === 'labor' ? 'Days Worked' : 'Units'}
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-right font-mono text-sm text-white transition-colors placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      {logType === 'material' ? 'Unit Price (KES)' : logType === 'labor' ? 'Daily Rate (KES)' : 'Amount per Unit (KES)'}
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-right font-mono text-sm text-white transition-colors placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>

                {logType === 'material' && selectedMarketPrice && (
                  <div className="border border-orange-500/20 bg-orange-500/10 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">Market Average</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-white">
                      KES {Number(selectedMarketPrice.averagePrice || 0).toLocaleString()} per {selectedMarketPrice.unit}
                    </p>
                    {price && (
                      <p className={`mt-1 text-xs font-semibold ${priceDifference > 0 ? 'text-orange-400' : priceDifference < 0 ? 'text-zinc-300' : 'text-zinc-500'}`}>
                        {priceDifference === 0
                          ? 'This rate matches the saved average.'
                          : `${Math.abs(priceDifference).toLocaleString()} KES ${priceDifference > 0 ? 'above' : 'below'} the saved average.`}
                      </p>
                    )}
                  </div>
                )}

                <button type="submit" className="w-full rounded-md bg-orange-600 py-2.5 text-sm font-bold text-black transition-colors hover:bg-orange-500">
                  Save to Digital Ledger
                </button>
              </form>
            </section>

            <section className="border border-zinc-800 bg-zinc-900/30 p-5">
              <div className="border-b border-zinc-800 pb-4">
                <h2 className="text-lg font-bold tracking-tight text-white">Average Market Prices</h2>
                <p className="mt-1 text-sm font-medium text-zinc-500">Reference rates for common site materials.</p>
              </div>

              <form onSubmit={handleMarketPriceSubmit} className="mt-5 grid grid-cols-1 gap-3">
                <input
                  type="text"
                  value={marketMaterialName}
                  onChange={(e) => setMarketMaterialName(e.target.value)}
                  placeholder="Material"
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white transition-colors placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={marketUnit}
                    onChange={(e) => setMarketUnit(e.target.value)}
                    placeholder="Unit"
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white transition-colors placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    min="1"
                    value={marketAveragePrice}
                    onChange={(e) => setMarketAveragePrice(e.target.value)}
                    placeholder="Avg KES"
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-right font-mono text-sm text-white transition-colors placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <input
                  type="text"
                  value={marketSource}
                  onChange={(e) => setMarketSource(e.target.value)}
                  placeholder="Source"
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white transition-colors placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 py-2.5 text-sm font-bold text-white transition-colors hover:border-orange-500 hover:text-orange-400"
                >
                  Save Price
                </button>
                {marketError && <p className="text-sm font-semibold text-orange-400">{marketError}</p>}
              </form>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      <th className="pb-2">Material</th>
                      <th className="pb-2">Unit</th>
                      <th className="pb-2 text-right">Average</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900 text-sm">
                    {marketPrices.map((item) => (
                      <tr key={item.id} className="transition-colors hover:bg-zinc-900/50">
                        <td className="py-3 font-semibold text-white">
                          {item.materialName}
                          <p className="mt-0.5 text-xs font-medium text-zinc-600">{item.source || 'Manual market check'}</p>
                        </td>
                        <td className="py-3 text-zinc-400">{item.unit}</td>
                        <td className="py-3 text-right font-mono font-semibold text-white">
                          KES {Number(item.averagePrice || 0).toLocaleString()}
                          {!item.isDefault && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMarketPrice(item.id)}
                              className="ml-3 text-xs font-semibold text-orange-400 transition-colors hover:text-orange-300"
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
          </aside>

          <main className="space-y-6 lg:col-span-2">
            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="border border-orange-500/30 bg-zinc-900/40 p-5 ring-1 ring-orange-500/10 md:col-span-3 xl:col-span-1">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Remaining Balance</h3>
                <p className="mt-2 font-mono text-3xl font-bold tracking-tight text-white">KES {(projectBudget - totalSpent).toLocaleString()}</p>
              </div>
              <div className="border border-zinc-800 bg-zinc-900/20 p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Project Budget</h3>
                <p className="mt-2 font-mono text-xl font-bold text-white">KES {projectBudget.toLocaleString()}</p>
              </div>
              <div className="border border-zinc-800 bg-zinc-900/20 p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Funds Spent</h3>
                <p className="mt-2 font-mono text-xl font-bold text-orange-500">KES {totalSpent.toLocaleString()}</p>
              </div>
            </section>

            <section className="border border-zinc-800 bg-zinc-900/30 p-5">
              <div className="flex flex-col gap-4 border-b border-zinc-800 pb-4 md:flex-row md:items-center md:justify-between">
                <h2 className="text-lg font-bold tracking-tight text-white">Live Site Ledger</h2>
                <div className="w-full md:w-80">
                  <label className="sr-only" htmlFor="ledger-search">Search previous entries</label>
                  <input
                    id="ledger-search"
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search entries..."
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white transition-colors placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              {logs.length === 0 ? (
                <p className="py-12 text-center font-medium text-zinc-500">No expenses logged yet for this project.</p>
              ) : filteredLogs.length === 0 ? (
                <p className="py-12 text-center font-medium text-zinc-500">No entries match your search.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        <th className="pb-2 pt-4">Type</th>
                        <th className="pb-2 pt-4">Description / Name</th>
                        <th className="pb-2 pt-4 text-right">Qty / Days</th>
                        <th className="pb-2 pt-4 text-right">Rate</th>
                        <th className="pb-2 pt-4 text-right">Total Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900 text-sm">
                      {filteredLogs.map((log) => (
                        <tr key={log.id} className="transition-colors hover:bg-zinc-900/50">
                          <td className="py-4">
                            <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-medium uppercase ${log.type === 'material' ? 'border-orange-500/20 bg-orange-500/10 text-orange-400' : log.type === 'labor' ? 'border-zinc-700 bg-zinc-950 text-zinc-300' : 'border-zinc-800 bg-zinc-900 text-zinc-400'}`}>
                              {log.type}
                            </span>
                          </td>
                          <td className="py-4 font-semibold text-white">{log.itemName}</td>
                          <td className="py-4 text-right font-mono text-zinc-400">{log.quantity}</td>
                          <td className="py-4 text-right font-mono text-zinc-400">KES {log.price.toLocaleString()}</td>
                          <td className="py-4 text-right font-mono font-bold text-white">KES {log.total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="border border-zinc-800 bg-zinc-900/30 p-5">
              <div className="flex flex-col gap-5 border-b border-zinc-800 pb-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-white">Progress Photo Bay</h2>
                  <p className="mt-1 text-sm font-medium text-zinc-500">Upload site progress images for this project.</p>
                </div>

                <form onSubmit={handlePhotoUpload} className="w-full space-y-3 md:max-w-md">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2.5 text-sm text-zinc-400 transition-colors file:mr-4 file:rounded-md file:border file:border-zinc-700 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:border-orange-500 focus:border-orange-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={photoCaption}
                    onChange={(e) => setPhotoCaption(e.target.value)}
                    placeholder="Caption, phase, or site note"
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white transition-colors placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
                  />
                  {photoError && <p className="text-sm font-semibold text-orange-400">{photoError}</p>}
                  <button
                    type="submit"
                    disabled={uploadingPhoto}
                    className="w-full rounded-md bg-orange-600 py-2.5 text-sm font-bold text-black transition-colors hover:bg-orange-500 disabled:bg-zinc-700 disabled:text-zinc-400"
                  >
                    {uploadingPhoto
                      ? `Uploading Photo${photoUploadProgress !== null ? ` ${photoUploadProgress}%` : '...'}`
                      : 'Add Progress Photo'}
                  </button>
                </form>
              </div>

              {photos.length === 0 ? (
                <p className="py-10 text-center font-medium text-zinc-500">No progress photos uploaded yet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 pt-5 sm:grid-cols-2 xl:grid-cols-3">
                  {photos.map((photo) => (
                    <article key={photo.id} className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
                      <img
                        src={photo.imageUrl}
                        alt={photo.caption || 'Build progress'}
                        className="aspect-video w-full bg-zinc-900 object-cover"
                      />
                      <div className="p-3">
                        <p className="text-sm font-bold text-white">{photo.caption || 'Progress update'}</p>
                        <p className="mt-1 font-mono text-xs font-medium text-zinc-500">
                          {photo.createdAt ? new Date(photo.createdAt).toLocaleDateString() : 'Recently added'}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
