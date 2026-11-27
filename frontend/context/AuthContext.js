import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { tokenStorage } from '../services/storage';
import { authService, setUnauthorizedHandler } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  // isLoading strictly tracks initial session restoration so login/register errors do not re-trigger root guards
  const [isLoading, setIsLoading] = useState(true);
  const beforeLogoutHookRef = React.useRef(null);

  const setBeforeLogoutHook = useCallback((fn) => {
    beforeLogoutHookRef.current = fn;
  }, []);

  const clearSession = useCallback(async () => {
    try {
      await tokenStorage.clearAll();
    } catch (e) {
      console.warn('Error clearing storage on session reset', e);
    } finally {
      setUser(null);
      setToken(null);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    checkAuthSession();
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const checkAuthSession = async () => {
    try {
      setIsLoading(true);
      const storedToken = await tokenStorage.getToken();
      const storedUser = await tokenStorage.getUser();

      if (storedToken) {
        setToken(storedToken);
        if (storedUser) {
          setUser(storedUser);
        }

        // Validate JWT against backend with short startup timeout
        try {
          const res = await authService.getMe({ timeout: 6000 });
          if (res?.data?.user) {
            setUser(res.data.user);
            await tokenStorage.setUser(res.data.user);
          }
        } catch (apiError) {
          console.warn('Session check with backend failed:', apiError.message);
          if (apiError.status === 401) {
            await clearSession();
          } else if (!storedUser) {
            // Token exists without cached user and backend unreachable
            await clearSession();
          }
        }
      }
    } catch (e) {
      console.warn('Failed to restore authentication session:', e);
      await clearSession();
    } finally {
      setIsLoading(false);
    }
  };

  const saveSession = async (receivedToken, receivedUser, actionName) => {
    if (!receivedToken || !receivedUser) {
      throw new Error(`Invalid ${actionName} response received from server.`);
    }

    await tokenStorage.setToken(receivedToken);
    await tokenStorage.setUser(receivedUser);

    setToken(receivedToken);
    setUser(receivedUser);

    return { success: true, user: receivedUser };
  };

  const login = async (email, password) => {
    const res = await authService.login(email, password);
    return saveSession(res?.data?.token, res?.data?.user, 'login');
  };

  const register = async (name, email, password, confirmPassword) => {
    const res = await authService.register(name, email, password, confirmPassword);
    return saveSession(res?.data?.token, res?.data?.user, 'registration');
  };

  const logout = async () => {
    if (beforeLogoutHookRef.current) {
      try {
        await beforeLogoutHookRef.current();
      } catch (e) {
        console.warn('Pre-logout hook failed:', e.message);
      }
    }
    await clearSession();
  };

  const refreshUser = async () => {
    try {
      const res = await authService.getMe();
      if (res?.data?.user) {
        setUser(res.data.user);
        await tokenStorage.setUser(res.data.user);
      }
    } catch (e) {
      console.warn('Failed to refresh user data', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        isAdmin: user?.role === 'admin',
        login,
        register,
        logout,
        refreshUser,
        checkAuthSession,
        setBeforeLogoutHook,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
