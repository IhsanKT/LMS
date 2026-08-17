import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, LogOut, Shield } from 'lucide-react';
import { getSession, clearSession, isAdmin } from '../api';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const user = getSession();
  const admin = isAdmin();

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'SP';

  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center text-white shadow-sm">
          <GraduationCap size={24} />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 leading-tight">Examination Portal</h1>
          <p className="text-xs text-gray-500 font-medium">Powered by Tensors</p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {admin && (
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <Shield size={14} /> Admin Panel
          </button>
        )}

        <div className="text-right">
          <span className="block text-sm font-semibold text-gray-900">
            {user?.name || (admin ? 'Admin' : 'Student Portal')}
          </span>
          <span className="block text-xs text-gray-500">{user?.email || 'Welcome back!'}</span>
        </div>
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm shadow-sm ring-1 ring-emerald-100">
          {initials}
        </div>
        <button
          onClick={handleLogout}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
