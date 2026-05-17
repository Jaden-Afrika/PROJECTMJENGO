import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, query, where } from 'firebase/firestore';

const ProjectSelection = ({ onSelectProject }) => {
  const { user, logout } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [projects, setProjects] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    budget: '',
    location: '',
    type: 'Residential Build',
    manager: user?.displayName || '',
    startDate: '',
    notes: ''
  });

  useEffect(() => {
    if (!user?.uid) return undefined;

    const q = query(collection(db, 'mjengo_projects'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      projectData.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setProjects(projectData);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.budget || !formData.location || !formData.manager) {
      setError('Please add the project name, budget, site location, and manager.');
      return;
    }

    const budget = Number(formData.budget);
    if (!Number.isFinite(budget) || budget <= 0) {
      setError('Budget must be a valid amount greater than zero.');
      return;
    }

    setSubmitting(true);

    try {
      const project = {
        userId: user.uid,
        name: formData.name.trim(),
        budget,
        location: formData.location.trim(),
        type: formData.type,
        manager: formData.manager.trim(),
        startDate: formData.startDate,
        notes: formData.notes.trim(),
        status: 'active',
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'mjengo_projects'), project);
      onSelectProject({ id: docRef.id, ...project });
    } catch (err) {
      console.error('Error creating project: ', err);
      setError('Could not create the project. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat relative p-4 md:p-8"
      style={{ 
        backgroundImage: `url('/dashbg.jpg')`
      }}
    >
      <div className="absolute inset-0 bg-white/25 backdrop-blur-[1px] z-0"></div>

      <div className="max-w-5xl mx-auto relative z-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-6 mb-8 gap-4 border-slate-300">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Project Mjengo</h1>
            <p className="text-slate-600 font-semibold mt-1">Choose a site ledger or set up a new one.</p>
          </div>
          
          <div className="flex items-center gap-4 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
            <span className="text-sm font-semibold text-slate-700 px-2">Site Manager: {user?.displayName || 'Manager'}</span>
            <button onClick={logout} className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-bold transition-all">
              Log Out
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <section className="lg:col-span-1 bg-white p-6 rounded-lg border border-gray-200 shadow-sm h-fit">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4 mb-5">
              <div>
                <h2 className="text-lg font-black text-black">New Project</h2>
                <p className="text-sm font-medium text-gray-500 mt-1">Create a budget workspace for a site.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateForm((current) => !current)}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-4 py-2 rounded-lg transition-all"
              >
                {showCreateForm ? 'Close' : 'Create'}
              </button>
            </div>

            {showCreateForm ? (
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">Project Name</label>
                  <input
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g., Kilimani Three-Bedroom House"
                    className="w-full bg-white border border-gray-300 rounded-lg p-3 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">Total Budget (KES)</label>
                  <input
                    name="budget"
                    type="number"
                    min="1"
                    value={formData.budget}
                    onChange={handleChange}
                    placeholder="2500000"
                    className="w-full bg-white border border-gray-300 rounded-lg p-3 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">Site Location</label>
                  <input
                    name="location"
                    type="text"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="e.g., Nairobi, Kenya"
                    className="w-full bg-white border border-gray-300 rounded-lg p-3 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">Project Type</label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className="w-full bg-white border border-gray-300 rounded-lg p-3 font-medium text-black focus:outline-none focus:ring-2 focus:ring-orange-600"
                  >
                    <option>Residential Build</option>
                    <option>Commercial Build</option>
                    <option>Renovation</option>
                    <option>Foundation Works</option>
                    <option>Finishing Works</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">Project Manager</label>
                  <input
                    name="manager"
                    type="text"
                    value={formData.manager}
                    onChange={handleChange}
                    placeholder="Site manager name"
                    className="w-full bg-white border border-gray-300 rounded-lg p-3 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">Start Date</label>
                  <input
                    name="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={handleChange}
                    className="w-full bg-white border border-gray-300 rounded-lg p-3 text-black focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">Site Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Key suppliers, phase notes, or scope details"
                    rows="3"
                    className="w-full bg-white border border-gray-300 rounded-lg p-3 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>

                {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-black hover:bg-orange-700 disabled:bg-gray-400 text-white font-bold p-3 rounded-lg transition-all"
                >
                  {submitting ? 'Creating Project...' : 'Start Working'}
                </button>
              </form>
            ) : (
              <button 
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="group w-full flex flex-col items-center justify-center p-8 bg-orange-50 hover:bg-black rounded-lg border border-orange-200 transition-all text-center"
              >
                <div className="w-14 h-14 bg-white group-hover:bg-orange-600 text-orange-600 group-hover:text-white rounded-lg flex items-center justify-center mb-4 transition-all border border-orange-200">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h3 className="text-lg font-black text-black group-hover:text-white transition-all">Create New Project</h3>
                <p className="text-xs text-gray-600 font-medium mt-1 group-hover:text-orange-100 transition-all">Name the site, set the budget, and open a clean ledger.</p>
              </button>
            )}
          </section>

          <section className="lg:col-span-2 bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="border-b border-gray-200 pb-4 mb-5">
              <h2 className="text-lg font-black text-black">Ongoing Projects</h2>
              <p className="text-sm font-medium text-gray-500 mt-1">Continue from an active project workspace.</p>
            </div>

            {projects.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                <p className="text-black font-bold">No projects yet.</p>
                <p className="text-sm text-gray-500 mt-1">Create your first project to start tracking materials, labor, and spend.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => onSelectProject(project)}
                    className="text-left bg-gray-50 hover:bg-black border border-gray-200 hover:border-black rounded-lg p-5 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black text-black group-hover:text-white">{project.name}</h3>
                        <p className="text-xs font-bold uppercase tracking-wider text-orange-600 mt-1">{project.type}</p>
                      </div>
                      <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded-md group-hover:bg-orange-600 group-hover:text-white">
                        Active
                      </span>
                    </div>

                    <div className="mt-5 space-y-2 text-sm font-semibold text-gray-600 group-hover:text-gray-200">
                      <p>Budget: KES {Number(project.budget || 0).toLocaleString()}</p>
                      <p>Location: {project.location || 'Not set'}</p>
                      <p>Manager: {project.manager || 'Not set'}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default ProjectSelection;
