import { create } from 'zustand';

const useAuthStore = create((set) => ({
    user: null,
    isLoggedIn: false,
    role: null,
    
    setUser: (user) => set({ user, isLoggedIn: !!user, role: user?.role || null }),
    logout: () => set({ user: null, isLoggedIn: false, role: null })
}));

export default useAuthStore;
