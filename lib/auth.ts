import Cookies from 'js-cookie';
import { User, Workspace } from './types';

const USER_KEY = 'sms_user';
const WORKSPACE_KEY = 'sms_workspace';

export const authUtils = {
  // User methods
  getUser: (): User | null => {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  },

  setUser: (user: User) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clearUser: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(WORKSPACE_KEY);
  },

  // Workspace methods
  getWorkspace: (): Workspace | null => {
    if (typeof window === 'undefined') return null;
    const workspaceStr = localStorage.getItem(WORKSPACE_KEY);
    return workspaceStr ? JSON.parse(workspaceStr) : null;
  },

  setWorkspace: (workspace: Workspace) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
  },

  // Check if user is authenticated
  isAuthenticated: (): boolean => {
    return !!authUtils.getUser();
  },
};
